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

export type Usuario = { id: string; email: string; name: string; role: string };

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
    const linha = await banco().prepare(
      `SELECT s.id AS sid, s.expires, u.id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    ).bind(id).first<{ sid: string; expires: string; id: string; email: string; name: string; role: string }>();
    if (!linha) return null;

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
    return { id: linha.id, email: linha.email, name: linha.name, role: linha.role };
  } catch { return null; }
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
