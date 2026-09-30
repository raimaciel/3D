/*
 * Sessão no banco e guarda das rotas.
 *
 * Regra de ouro deste arquivo: o cookie carrega o TOKEN, o banco guarda o
 * HASH do token. Quem ler a tabela de sessões não consegue se passar por
 * ninguém.
 */
import { env } from 'cloudflare:workers';
import { hashToken, novoToken } from './auth.ts';

export const COOKIE = 'gestao3d_sessao';
const DIAS = 30;
const RENOVA_QUANDO_FALTAM_DIAS = 7;

/** `trocarSenha`: entrou com senha temporária e ainda não trocou. */
export type Usuario = { id: string; email: string; name: string; role: string; trocarSenha?: boolean };

/*
 * Situação de cada usuário (30/09/2026): ativo ou desativado, e se precisa
 * trocar a senha temporária. Mora numa tabela à parte, criada aqui mesmo no
 * primeiro uso (CREATE TABLE IF NOT EXISTS), para o dono não precisar rodar
 * SQL no painel. Usuário sem linha nesta tabela conta como ativo.
 * `pronto` evita repetir o CREATE a cada requisição no mesmo processo.
 */
let tabelaStatusPronta = false;
export async function garantirTabelaStatus(): Promise<void> {
  if (tabelaStatusPronta) return;
  await banco().prepare(
    'CREATE TABLE IF NOT EXISTS user_status (user_id TEXT PRIMARY KEY NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0)'
  ).run();
  tabelaStatusPronta = true;
}

export async function definirStatus(userId: string, s: { active?: boolean; mustChange?: boolean }): Promise<void> {
  await garantirTabelaStatus();
  const atual = await banco().prepare('SELECT active,must_change FROM user_status WHERE user_id=?')
    .bind(userId).first<{ active: number; must_change: number }>();
  const active = s.active ?? (atual ? atual.active === 1 : true);
  const mustChange = s.mustChange ?? (atual ? atual.must_change === 1 : false);
  await banco().prepare(
    'INSERT INTO user_status (user_id,active,must_change) VALUES (?,?,?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET active=excluded.active, must_change=excluded.must_change'
  ).bind(userId, active ? 1 : 0, mustChange ? 1 : 0).run();
}

export async function lerStatus(userId: string): Promise<{ active: boolean; mustChange: boolean }> {
  await garantirTabelaStatus();
  const r = await banco().prepare('SELECT active,must_change FROM user_status WHERE user_id=?')
    .bind(userId).first<{ active: number; must_change: number }>();
  return { active: r ? r.active === 1 : true, mustChange: r ? r.must_change === 1 : false };
}

export function banco(): D1Database {
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!db) throw new Error('Banco de dados indisponível.');
  return db;
}

export function lerCookie(request: Request, nome: string): string {
  const bruto = request.headers.get('cookie') ?? '';
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return '';
}

/** Em http (desenvolvimento local) o navegador ignora cookie Secure, então só o marca em https. */
function cookieSessao(request: Request, token: string, segundos: number): string {
  const seguro = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}${seguro}`;
}
export const cookieDeEntrada = (request: Request, token: string) => cookieSessao(request, token, DIAS * 86400);
export const cookieDeSaida = (request: Request) => cookieSessao(request, '', 0);

export async function criarSessao(userId: string): Promise<string> {
  const token = novoToken(), agora = new Date();
  const expira = new Date(agora.getTime() + DIAS * 86400_000);
  await banco().prepare('INSERT INTO sessions (id,user_id,expires,created) VALUES (?,?,?,?)')
    .bind(await hashToken(token), userId, expira.toISOString(), agora.toISOString()).run();
  return token;
}

export async function encerrarSessao(token: string): Promise<void> {
  if (!token) return;
  await banco().prepare('DELETE FROM sessions WHERE id=?').bind(await hashToken(token)).run();
}

/**
 * Desconecta a pessoa de todos os aparelhos, menos do atual (se houver).
 * Usado ao trocar ou recuperar a senha: se alguém estava usando a conta sem
 * permissão, perde o acesso na hora.
 */
export async function encerrarOutrasSessoes(userId: string, tokenAtual?: string): Promise<void> {
  if (tokenAtual) {
    await banco().prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').bind(userId, await hashToken(tokenAtual)).run();
  } else {
    await banco().prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
  }
}

export async function limparSessoesVencidas(): Promise<void> {
  try { await banco().prepare('DELETE FROM sessions WHERE expires < ?').bind(new Date().toISOString()).run(); }
  catch { /* limpeza é oportunista: falhar aqui não pode derrubar o login */ }
}

/** Devolve o usuário do cookie, ou null. Nunca lança. */
export async function usuarioDaRequisicao(request: Request): Promise<Usuario | null> {
  try {
    const token = lerCookie(request, COOKIE);
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const id = await hashToken(token);
    await garantirTabelaStatus();
    const linha = await banco().prepare(
      `SELECT s.id AS sid, s.expires, u.id, u.email, u.name, u.role, st.active, st.must_change
         FROM sessions s JOIN users u ON u.id = s.user_id
         LEFT JOIN user_status st ON st.user_id = u.id
        WHERE s.id = ?`
    ).bind(id).first<{ sid: string; expires: string; id: string; email: string; name: string; role: string; active: number | null; must_change: number | null }>();
    if (!linha) return null;
    // Usuário desativado perde o acesso na hora, mesmo com sessão aberta.
    if (linha.active === 0) {
      await banco().prepare('DELETE FROM sessions WHERE id=?').bind(id).run();
      return null;
    }

    const expira = Date.parse(linha.expires);
    if (!Number.isFinite(expira) || expira <= Date.now()) {
      await banco().prepare('DELETE FROM sessions WHERE id=?').bind(id).run();
      return null;
    }
    // Renova só quando está perto de vencer, para não gravar a cada requisição.
    if (expira - Date.now() < RENOVA_QUANDO_FALTAM_DIAS * 86400_000) {
      await banco().prepare('UPDATE sessions SET expires=? WHERE id=?')
        .bind(new Date(Date.now() + DIAS * 86400_000).toISOString(), id).run();
    }
    return { id: linha.id, email: linha.email, name: linha.name, role: linha.role, trocarSenha: linha.must_change === 1 };
  } catch (e) { console.error('FALHA ao ler a sessao:', e instanceof Error ? e.message : String(e)); return null; }
}

const negado = (msg: string, status: number) =>
  Response.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Guarda de leitura: exige sessão válida. Devolve o usuário ou a resposta a devolver. */
export async function exigirUsuario(request: Request): Promise<Usuario | Response> {
  const u = await usuarioDaRequisicao(request);
  return u ?? negado('Entre na sua conta para continuar.', 401);
}

/** Só a equipe mexe na gestão. O papel "cliente" existe para o portal futuro. */
export async function exigirEquipe(request: Request): Promise<Usuario | Response> {
  const u = await exigirUsuario(request);
  if (u instanceof Response) return u;
  if (u.role !== 'admin' && u.role !== 'equipe') return negado('Sua conta não tem acesso a esta área.', 403);
  // Senha temporária: nada da gestão abre antes de trocar. A troca em si usa
  // exigirUsuario, que não tem esta trava.
  if (u.trocarSenha) return negado('Troque sua senha temporária para continuar.', 403);
  return u;
}

/** Só o administrador mexe em Usuários. */
export async function exigirAdmin(request: Request): Promise<Usuario | Response> {
  const u = await exigirEquipe(request);
  if (u instanceof Response) return u;
  if (u.role !== 'admin') return negado('Só o administrador pode fazer isso.', 403);
  return u;
}

/**
 * Defesa contra CSRF. Em requisição que ALTERA dados, o Origin é obrigatório e
 * precisa bater. A checagem antiga aceitava Origin ausente, o que a tornava
 * inútil: bastava um cliente que não envia o cabeçalho.
 */
export function origemInvalida(request: Request): Response | null {
  const origem = request.headers.get('origin');
  if (!origem || origem !== new URL(request.url).origin) return negado('Origem inválida.', 403);
  return null;
}

export async function existeAlgumUsuario(): Promise<boolean> {
  const r = await banco().prepare('SELECT 1 FROM users LIMIT 1').first();
  return !!r;
}
