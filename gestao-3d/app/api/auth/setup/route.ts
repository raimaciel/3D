import { env } from 'cloudflare:workers';
import { hashSenha, normalizarEmail, emailValido, problemaNaSenha, comparaSegura } from '@/lib/auth';
import { banco, criarSessao, cookieDeEntrada, origemInvalida, existeAlgumUsuario } from '@/lib/sessao';

/*
 * Cria o PRIMEIRO acesso, e só ele: depois que existe um usuário, esta rota
 * fecha para sempre. Se a variável SETUP_TOKEN estiver configurada no provedor,
 * ela também é exigida — é o que protege a janela entre publicar e configurar.
 */
export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  try {
    if (await existeAlgumUsuario())
      return Response.json({ error: 'O sistema já está configurado. Faça login.' }, { status: 409 });

    const corpo = await request.json() as Record<string, unknown>;
    const esperado = (env as unknown as { SETUP_TOKEN?: string }).SETUP_TOKEN;
    if (esperado && !comparaSegura(String(corpo.token ?? ''), esperado))
      return Response.json({ error: 'Código de configuração inválido.' }, { status: 403 });

    const email = normalizarEmail(corpo.email);
    const nome = String(corpo.nome ?? '').trim();
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
    if (!emailValido(email)) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    if (!nome || nome.length > 200) return Response.json({ error: 'Informe seu nome.' }, { status: 400 });
    const problema = problemaNaSenha(senha);
    if (problema) return Response.json({ error: problema }, { status: 400 });

    const id = crypto.randomUUID();
    const r = await banco().prepare(
      'INSERT INTO users (id,email,name,role,password,created) ' +
      "SELECT ?,?,?,'admin',?,? WHERE NOT EXISTS (SELECT 1 FROM users)"
    ).bind(id, email, nome, await hashSenha(senha), new Date().toISOString()).run();
    // A condição no próprio INSERT fecha a corrida de dois cadastros simultâneos.
    if (!r.meta.changes) return Response.json({ error: 'O sistema já está configurado. Faça login.' }, { status: 409 });

    const token = await criarSessao(id);
    return Response.json({ usuario: { id, email, name: nome, role: 'admin' } },
      { headers: { 'Set-Cookie': cookieDeEntrada(request, token), 'Cache-Control': 'no-store' } });
  } catch (e) {
    // Registrado de proposito: sem isto a causa fica invisivel e so resta
    // adivinhar. Aparece em Observability -> Logs, no painel da Cloudflare.
    console.error('FALHA EM /api/auth/setup:', e instanceof Error ? e.message : String(e),
                  e instanceof Error ? e.stack : '');
    return Response.json({ error: 'Não foi possível criar o acesso.' }, { status: 503 });
  }
}
