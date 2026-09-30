import { conferirSenha, hashSenha, problemaNaSenha } from '@/lib/auth';
import { banco, COOKIE, encerrarOutrasSessoes, exigirUsuario, lerCookie, origemInvalida } from '@/lib/sessao';
import { conferirTrava, limparFalhas, registrarFalha } from '@/lib/limite';

/*
 * Trocar a senha, com a pessoa já dentro do sistema. Pede a senha ATUAL:
 * sem isso, quem pegasse um celular com o sistema aberto trocaria a senha e
 * tomaria a conta. Depois de trocar, os outros aparelhos são desconectados.
 */
export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const usuario = await exigirUsuario(request);
  if (usuario instanceof Response) return usuario;
  try {
    const corpo = await request.json() as { atual?: unknown; nova?: unknown };
    const atual = typeof corpo.atual === 'string' ? corpo.atual : '';
    const nova = typeof corpo.nova === 'string' ? corpo.nova : '';

    const trava = await conferirTrava(usuario.email);
    if (trava.travado) return Response.json({ error: `Muitas tentativas. Tente de novo em ${trava.minutos} min.` }, { status: 429 });

    const u = await banco().prepare('SELECT password FROM users WHERE id=?').bind(usuario.id).first<{ password: string }>();
    if (!u || !(await conferirSenha(atual, u.password))) {
      await registrarFalha(usuario.email);
      return Response.json({ error: 'A senha atual não confere.' }, { status: 401 });
    }
    const problema = problemaNaSenha(nova);
    if (problema) return Response.json({ error: problema }, { status: 400 });
    if (nova === atual) return Response.json({ error: 'A senha nova precisa ser diferente da atual.' }, { status: 400 });

    await banco().prepare('UPDATE users SET password=? WHERE id=?').bind(await hashSenha(nova), usuario.id).run();
    await limparFalhas(usuario.email);
    await encerrarOutrasSessoes(usuario.id, lerCookie(request, COOKIE));
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM /api/auth/senha:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível trocar a senha. Tente de novo.' }, { status: 503 });
  }
}
