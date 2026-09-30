import { comparaSegura, hashSenha, hashToken, normalizarCodigo, normalizarEmail, problemaNaSenha } from '@/lib/auth';
import { banco, cookieDeEntrada, criarSessao, encerrarOutrasSessoes, origemInvalida } from '@/lib/sessao';
import { conferirTrava, limparFalhas, registrarFalha } from '@/lib/limite';
import { apagarCodigo, lerCodigo } from '@/lib/recuperacao';

/*
 * "Esqueci minha senha": e-mail + código de recuperação + senha nova.
 *
 * - Mesma mensagem para e-mail inexistente e código errado, como no login.
 * - Conta tentativas na mesma trava do login (8 erros travam).
 * - O código vale UMA vez: usou, apaga. A pessoa gera outro depois.
 * - Todos os aparelhos logados são desconectados, e a pessoa entra só neste.
 */
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
    const guardado = u ? await lerCodigo(u.id) : null;
    const confere = comparaSegura(await hashToken(codigo), guardado?.hash || '');
    if (!u || !guardado || !confere) {
      await registrarFalha(email);
      return Response.json({ error: 'E-mail ou código de recuperação incorretos.' }, { status: 401 });
    }

    await banco().prepare('UPDATE users SET password=? WHERE id=?').bind(await hashSenha(nova), u.id).run();
    await apagarCodigo(u.id);
    await limparFalhas(email);
    await encerrarOutrasSessoes(u.id);
    const token = await criarSessao(u.id);
    return Response.json(
      { usuario: { id: u.id, email: u.email, name: u.name, role: u.role } },
      { headers: { 'Set-Cookie': cookieDeEntrada(request, token), 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM /api/auth/recuperar:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível recuperar o acesso. Tente de novo.' }, { status: 503 });
  }
}
