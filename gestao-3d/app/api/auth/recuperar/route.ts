import { env } from 'cloudflare:workers';
import { comparaSegura, hashSenha, hashToken, normalizarCodigo, normalizarEmail, problemaNaSenha } from '@/lib/auth';
import { banco, cookieDeEntrada, criarSessao, definirStatus, encerrarOutrasSessoes, lerStatus, origemInvalida } from '@/lib/sessao';
import { conferirTrava, limparFalhas, registrarFalha } from '@/lib/limite';
import { apagarCodigo, lerCodigo } from '@/lib/recuperacao';

/*
 * "Esqueci minha senha": e-mail + código de recuperação + senha nova.
 *
 * - Mesma mensagem para e-mail inexistente e código errado, como no login.
 * - Conta tentativas na mesma trava do login (8 erros travam).
 * - O código vale UMA vez: usou, apaga. A pessoa gera outro depois.
 * - Todos os aparelhos logados são desconectados, e a pessoa entra só neste.
 *
 * CHAVE DE EMERGÊNCIA (30/09/2026): para o administrador que perdeu a senha E
 * o código. É um segredo chamado CHAVE_EMERGENCIA, cadastrado pelo dono no
 * painel da Cloudflare (Workers → 3d → Settings → Variables and Secrets). Só
 * quem entra na conta da Cloudflare consegue criá-la, então não abre porta
 * para estranhos. Vale no lugar do código, só para ADMINISTRADOR, e só se
 * tiver pelo menos 16 letras/números. Depois de usar, o dono deve apagá-la.
 */
function chaveEmergencia(): string {
  const bruta = (env as unknown as { CHAVE_EMERGENCIA?: string }).CHAVE_EMERGENCIA;
  const chave = normalizarCodigo(bruta || '');
  return chave.length >= 16 ? chave : '';
}

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  try {
    const corpo = await request.json() as { email?: unknown; codigo?: unknown; nova?: unknown };
    const email = normalizarEmail(corpo.email);
    const codigo = normalizarCodigo(corpo.codigo);
    const nova = typeof corpo.nova === 'string' ? corpo.nova : '';
    if (!email || !codigo) return Response.json({ error: 'Informe o e-mail e o código de recuperação.' }, { status: 400 });

    const trava = await conferirTrava(email);
    if (trava.travado) return Response.json({ error: `Muitas tentativas. Tente de novo em ${trava.minutos} min.` }, { status: 429 });

    const problema = problemaNaSenha(nova);
    if (problema) return Response.json({ error: problema }, { status: 400 });

    const u = await banco().prepare('SELECT id,email,name,role FROM users WHERE email=?')
      .bind(email).first<{ id: string; email: string; name: string; role: string }>();

    const chave = chaveEmergencia();
    const usouChave = !!chave && comparaSegura(codigo, chave) && u?.role === 'admin';
    const guardado = u && !usouChave ? await lerCodigo(u.id) : null;
    const confereCodigo = comparaSegura(await hashToken(codigo), guardado?.hash || '');
    if (!u || (!usouChave && (!guardado || !confereCodigo))) {
      await registrarFalha(email);
      return Response.json({ error: 'E-mail ou código de recuperação incorretos.' }, { status: 401 });
    }
    // Só depois de provar o código: não conta a estranhos que o e-mail existe.
    if (!(await lerStatus(u.id)).active)
      return Response.json({ error: 'Este acesso foi desativado. Fale com o administrador.' }, { status: 403 });

    await banco().prepare('UPDATE users SET password=? WHERE id=?').bind(await hashSenha(nova), u.id).run();
    if (usouChave) console.warn('CHAVE DE EMERGENCIA usada para recuperar o acesso de', email);
    else await apagarCodigo(u.id);
    await definirStatus(u.id, { mustChange: false });
    await limparFalhas(email);
    await encerrarOutrasSessoes(u.id);
    const token = await criarSessao(u.id);
    return Response.json(
      { usuario: { id: u.id, email: u.email, name: u.name, role: u.role }, usouChave },
      { headers: { 'Set-Cookie': cookieDeEntrada(request, token), 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM /api/auth/recuperar:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível recuperar o acesso. Tente de novo.' }, { status: 503 });
  }
}
