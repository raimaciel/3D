import { emailValido, normalizarEmail } from '@/lib/auth';
import { banco, exigirUsuario, garantirTabelaStatus, origemInvalida } from '@/lib/sessao';

/*
 * Meu perfil (30/09/2026). A pessoa pede para mudar nome, telefone e e-mail;
 * a mudança NÃO vale na hora: vira um pedido pendente que o administrador
 * aprova ou recusa em Usuários (decisão do dono). O e-mail é o login da
 * pessoa, por isso o cuidado.
 *   GET  -> dados atuais + pedido pendente, se houver
 *   POST -> { nome, telefone, email } cria ou substitui o pedido
 *           { cancelar: true } desiste do pedido
 * O admin também passa por aqui, mas o pedido dele pode ser aprovado por
 * ele mesmo em Usuários.
 */
const TELEFONE = /^[\d\s()+-]{0,30}$/;

export async function GET(request: Request) {
  const u = await exigirUsuario(request);
  if (u instanceof Response) return u;
  try {
    await garantirTabelaStatus();
    const tel = await banco().prepare('SELECT phone FROM user_profile WHERE user_id=?').bind(u.id).first<{ phone: string }>();
    const pedido = await banco().prepare('SELECT name,phone,email,created FROM profile_requests WHERE user_id=?').bind(u.id)
      .first<{ name: string; phone: string; email: string; created: string }>();
    return Response.json({ nome: u.name, email: u.email, telefone: tel?.phone || '', pedido: pedido || null },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM GET /api/perfil:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível carregar o seu perfil.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const u = await exigirUsuario(request);
  if (u instanceof Response) return u;
  try {
    await garantirTabelaStatus();
    const c = await request.json() as Record<string, unknown>;
    if (c.cancelar === true) {
      await banco().prepare('DELETE FROM profile_requests WHERE user_id=?').bind(u.id).run();
      return Response.json({ ok: true });
    }
    const nome = String(c.nome ?? '').trim(), telefone = String(c.telefone ?? '').trim(), email = normalizarEmail(c.email);
    if (!nome || nome.length > 200) return Response.json({ error: 'Informe o nome.' }, { status: 400 });
    if (!TELEFONE.test(telefone)) return Response.json({ error: 'Telefone inválido. Use só números, espaços, parênteses e traço.' }, { status: 400 });
    if (!emailValido(email)) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    const telAtual = (await banco().prepare('SELECT phone FROM user_profile WHERE user_id=?').bind(u.id).first<{ phone: string }>())?.phone || '';
    if (nome === u.name && telefone === telAtual && email === u.email)
      return Response.json({ error: 'Nada mudou em relação ao seu cadastro.' }, { status: 400 });
    if (email !== u.email) {
      const outro = await banco().prepare('SELECT 1 FROM users WHERE email=? AND id<>?').bind(email, u.id).first();
      if (outro) return Response.json({ error: 'Esse e-mail já é usado por outra pessoa.' }, { status: 400 });
    }
    await banco().prepare(
      'INSERT INTO profile_requests (user_id,name,phone,email,created) VALUES (?,?,?,?,?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, phone=excluded.phone, email=excluded.email, created=excluded.created'
    ).bind(u.id, nome, telefone, email, new Date().toISOString()).run();
    return Response.json({ ok: true });
  } catch (e) {
    console.error('FALHA EM POST /api/perfil:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível enviar o pedido. Tente de novo.' }, { status: 503 });
  }
}
