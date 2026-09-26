/*
 * Núcleo de autenticação: senha e token de sessão.
 *
 * Sem nenhuma referência à Cloudflare aqui de propósito — assim este arquivo
 * roda no Workers, no navegador e no Node, e pode ser testado sem subir nada
 * (lib/auth.teste.ts). A parte que fala com o banco mora em lib/sessao.ts.
 *
 * Usa só WebCrypto, que existe nos três ambientes.
 */

// PBKDF2 é o algoritmo de senha que o Workers oferece nativamente. O número de
// iterações fica GRAVADO junto do hash, então dá para aumentar depois sem
// invalidar as senhas antigas: o hash antigo continua sendo conferido com o
// número dele, e é regravado no próximo login.
export const ITERACOES_PADRAO = 150_000;

const enc = new TextEncoder();
const paraHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const deHex = (s: string) => new Uint8Array((s.match(/.{1,2}/g) ?? []).map(x => parseInt(x, 16)));

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iteracoes, hash: 'SHA-256' }, chave, 256);
  return paraHex(bits);
}

/** Guarda tudo o que é preciso para conferir depois: algoritmo, custo, sal e hash. */
export async function hashSenha(senha: string, iteracoes = ITERACOES_PADRAO): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iteracoes}$${paraHex(salt.buffer)}$${await derivar(senha, salt, iteracoes)}`;
}

/**
 * Confere a senha. Nunca lança: entrada malformada devolve false.
 * A comparação é em tempo constante, para não vazar o hash por cronometragem.
 */
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  try {
    const [algo, it, saltHex, hashHex] = String(guardado).split('$');
    if (algo !== 'pbkdf2' || !it || !saltHex || !hashHex) return false;
    const iteracoes = Number(it);
    if (!Number.isInteger(iteracoes) || iteracoes < 1000 || iteracoes > 5_000_000) return false;
    return comparaSegura(await derivar(senha, deHex(saltHex), iteracoes), hashHex);
  } catch { return false; }
}

/** Diz se o hash foi feito com menos iterações do que se usa hoje. */
export function senhaPrecisaRehash(guardado: string, iteracoes = ITERACOES_PADRAO): boolean {
  const [algo, it] = String(guardado).split('$');
  return algo !== 'pbkdf2' || Number(it) < iteracoes;
}

/** Token de sessão: 256 bits de aleatoriedade do sistema. É o segredo do cookie. */
export function novoToken(): string {
  return paraHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

/**
 * O banco guarda o HASH do token, nunca o token. Assim, se alguém ler a tabela
 * de sessões, não consegue se passar por ninguém. SHA-256 simples basta aqui:
 * o token já é aleatório de 256 bits, não há o que adivinhar.
 */
export async function hashToken(token: string): Promise<string> {
  return paraHex(await crypto.subtle.digest('SHA-256', enc.encode(token)));
}

/** Comparação em tempo constante: não retorna cedo na primeira diferença. */
export function comparaSegura(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Normaliza e-mail para comparação: espaços fora, tudo minúsculo. */
export const normalizarEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 200;
}

/**
 * Regra de senha. Curta demais é o risco real aqui; não exijo símbolo nem
 * maiúscula, porque isso empurra gente para senha pior e anotada no papel.
 */
export function problemaNaSenha(senha: string): string | null {
  if (typeof senha !== 'string' || senha.length < 10) return 'A senha precisa de pelo menos 10 caracteres.';
  if (senha.length > 200) return 'A senha é longa demais.';
  if (/^\d+$/.test(senha)) return 'Uma senha só de números é fácil de adivinhar. Misture letras.';
  return null;
}
