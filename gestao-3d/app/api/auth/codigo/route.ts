import { conferirSenha, hashToken, normalizarCodigo, novoCodigoRecuperacao } from '@/lib/auth';
import { banco, exigirUsuario, origemInvalida } from '@/lib/sessao';
import { conferirTrava, limparFalhas, registrarFalha } from '@/lib/limite';
import { lerCodigo, salvarCodigo } from '@/lib/recuperacao';

/*
 * Código de recuperação da própria pessoa.
 *   GET  -> se já existe um código e quando foi gerado (nunca o código).
 *   POST -> gera um novo, pedindo a senha atual. O código aparece UMA VEZ, na
 *           resposta; o banco guarda só o hash. Gerar outro invalida o antigo.
 */
export async function GET(request: Request) {
  const usuario = await exigirUsuario(request);
  if (usuario instanceof Response) return usuario;
  try {
    const c = await lerCodigo(usuario.id);
    return Response.json({ temCodigo: !!c, criadoEm: c?.created || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM GET /api/auth/codigo:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível consultar o código.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const usuario = await exigirUsuario(request);
  if (usuario instanceof Response) return usuario;
  try {
    const corpo = await request.json() as { senha?: unknown };
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';

    const trava = await conferirTrava(usuario.email);
    if (trava.travado) return Response.json({ error: `Muitas tentativas. Tente de novo em ${trava.minutos} min.` }, { status: 429 });

    // Pede a senha: quem pegasse um celular com o sistema aberto não pode
    // gerar um código para si e depois tomar a conta.
    const u = await banco().prepare('SELECT password FROM users WHERE id=?').bind(usuario.id).first<{ password: string }>();
    if (!u || !(await conferirSenha(senha, u.password))) {
      await registrarFalha(usuario.email);
      return Response.json({ error: 'A senha não confere.' }, { status: 401 });
    }
    await limparFalhas(usuario.email);

    const codigo = novoCodigoRecuperacao();
    const criadoEm = await salvarCodigo(usuario.id, await hashToken(normalizarCodigo(codigo)));
    return Response.json({ codigo, criadoEm }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM POST /api/auth/codigo:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível gerar o código. Tente de novo.' }, { status: 503 });
  }
}
