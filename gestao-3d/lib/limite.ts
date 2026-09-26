/*
 * Trava de força bruta no login. Sem isto, dá para testar senha na velocidade
 * da rede. Conta falhas por e-mail e bloqueia por um tempo crescente.
 */
import { banco } from './sessao.ts';

const LIMITE = 8;              // falhas antes de travar
const JANELA_MIN = 15;         // minutos que as falhas ficam contando
const TRAVA_MAX_MIN = 60;      // teto do bloqueio

export type Trava = { travado: boolean; minutos: number };

export async function conferirTrava(email: string): Promise<Trava> {
  try {
    const r = await banco().prepare('SELECT fails,until FROM login_attempts WHERE email=?')
      .bind(email).first<{ fails: number; until: string }>();
    if (!r) return { travado: false, minutos: 0 };
    const ate = Date.parse(r.until);
    if (!Number.isFinite(ate) || ate <= Date.now()) return { travado: false, minutos: 0 };
    if (r.fails < LIMITE) return { travado: false, minutos: 0 };
    return { travado: true, minutos: Math.max(1, Math.ceil((ate - Date.now()) / 60000)) };
  } catch { return { travado: false, minutos: 0 }; }
}

export async function registrarFalha(email: string): Promise<void> {
  try {
    const r = await banco().prepare('SELECT fails,until FROM login_attempts WHERE email=?')
      .bind(email).first<{ fails: number; until: string }>();
    const dentroDaJanela = r && Date.parse(r.until) > Date.now();
    const falhas = (dentroDaJanela ? r!.fails : 0) + 1;
    // Depois do limite, cada falha a mais estende o bloqueio, até o teto.
    const minutos = falhas < LIMITE ? JANELA_MIN
      : Math.min(TRAVA_MAX_MIN, JANELA_MIN * (falhas - LIMITE + 1));
    await banco().prepare(
      'INSERT INTO login_attempts (email,fails,until) VALUES (?,?,?) ' +
      'ON CONFLICT(email) DO UPDATE SET fails=excluded.fails, until=excluded.until'
    ).bind(email, falhas, new Date(Date.now() + minutos * 60000).toISOString()).run();
  } catch { /* não pode derrubar o login */ }
}

export async function limparFalhas(email: string): Promise<void> {
  try { await banco().prepare('DELETE FROM login_attempts WHERE email=?').bind(email).run(); }
  catch { /* idem */ }
}
