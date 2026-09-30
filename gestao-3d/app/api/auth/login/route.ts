import { conferirSenha, hashSenha, senhaPrecisaRehash, normalizarEmail } from '@/lib/auth';
import { banco, criarSessao, cookieDeEntrada, origemInvalida, limparSessoesVencidas, lerStatus } from '@/lib/sessao';
import { conferirTrava, registrarFalha, limparFalhas } from '@/lib/limite';

/*
 * Hash descartável, de uma senha que ninguém tem. Serve para gastar o mesmo
 * tempo de CPU quando o e-mail NÃO existe. Sem isto, a resposta volta rápido
 * nesse caso e devagar quando o e-mail existe — e o relógio entrega quais
 * e-mails estão cadastrados, mesmo com a mensagem de erro sendo igual.
 */
const HASH_DESCARTAVEL =
  'pbkdf2$150000$00000000000000000000000000000000$' + '0'.repeat(64);

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  try {
    const corpo = await request.json() as { email?: unknown; senha?: unknown };
    const email = normalizarEmail(corpo.email);
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
    if (!email || !senha) return Response.json({ error: 'Informe e-mail e senha.' }, { status: 400 });

    const trava = await conferirTrava(email);
    if (trava.travado) return Response.json(
      { error: `Muitas tentativas. Tente de novo em ${trava.minutos} min.` }, { status: 429 });

    const u = await banco().prepare('SELECT id,email,name,role,password FROM users WHERE email=?')
      .bind(email).first<{ id: string; email: string; name: string; role: string; password: string }>();

    // Mensagem igual para e-mail inexistente e senha errada: não conta a quem
    // está tentando se aquele e-mail existe no sistema.
    const confere = await conferirSenha(senha, u ? u.password : HASH_DESCARTAVEL);
    if (!u || !confere) {
      await registrarFalha(email);
      return Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    await limparFalhas(email);
    // Só depois da senha certa: não conta a estranhos que o e-mail existe.
    const status = await lerStatus(u.id);
    if (!status.active) return Response.json({ error: 'Este acesso foi desativado. Fale com o administrador.' }, { status: 403 });
    // Custo de hash pode subir com o tempo; regrava a senha no formato atual.
    if (senhaPrecisaRehash(u.password)) {
      try { await banco().prepare('UPDATE users SET password=? WHERE id=?').bind(await hashSenha(senha), u.id).run(); }
      catch { /* não impede a entrada */ }
    }
    await limparSessoesVencidas();

    const token = await criarSessao(u.id);
    return Response.json(
      { usuario: { id: u.id, email: u.email, name: u.name, role: u.role, trocarSenha: status.mustChange } },
      { headers: { 'Set-Cookie': cookieDeEntrada(request, token), 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM /api/auth/login:', e instanceof Error ? e.message : String(e),
                  e instanceof Error ? e.stack : '');
    return Response.json({ error: 'Não foi possível entrar. Tente de novo.' }, { status: 503 });
  }
}
