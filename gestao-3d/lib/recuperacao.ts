/*
 * Código de recuperação no banco (30/09/2026).
 *
 * Guarda só o SHA-256 do código, nunca o código: quem ler a tabela não
 * consegue recuperar a senha de ninguém. Um código por pessoa; gerar outro
 * substitui o anterior, e usar o código apaga ele (vale uma vez só).
 *
 * A tabela é criada aqui mesmo, na primeira vez que for usada
 * (CREATE TABLE IF NOT EXISTS). Assim o dono NÃO precisa rodar SQL no painel
 * da Cloudflare para esta função funcionar: foi colar SQL no console do D1
 * que já deu problema antes.
 */
import { banco } from './sessao.ts';

async function garantirTabela() {
  await banco().prepare(
    'CREATE TABLE IF NOT EXISTS recovery_codes (user_id TEXT PRIMARY KEY NOT NULL, hash TEXT NOT NULL, created TEXT NOT NULL)'
  ).run();
}

export async function salvarCodigo(userId: string, hash: string): Promise<string> {
  await garantirTabela();
  const agora = new Date().toISOString();
  await banco().prepare(
    'INSERT INTO recovery_codes (user_id,hash,created) VALUES (?,?,?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash, created=excluded.created'
  ).bind(userId, hash, agora).run();
  return agora;
}

export async function lerCodigo(userId: string): Promise<{ hash: string; created: string } | null> {
  await garantirTabela();
  return await banco().prepare('SELECT hash,created FROM recovery_codes WHERE user_id=?')
    .bind(userId).first<{ hash: string; created: string }>() ?? null;
}

export async function apagarCodigo(userId: string): Promise<void> {
  await garantirTabela();
  await banco().prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId).run();
}
