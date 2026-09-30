import { env } from 'cloudflare:workers';
import { emailValido, hashSenha, normalizarCodigo, normalizarEmail, senhaTemporaria } from '@/lib/auth';
import { banco, definirStatus, encerrarOutrasSessoes, exigirAdmin, garantirTabelaStatus, origemInvalida } from '@/lib/sessao';
import { MODULOS, modulosDoUsuario } from '@/lib/permissoes';

/*
 * Usuários (30/09/2026). Só o ADMINISTRADOR usa.
 *   GET  -> lista quem tem acesso, e se a chave de emergência está cadastrada
 *   POST -> { acao: 'criar' | 'editar' | 'redefinir' | 'ativar' , ... }
 *
 * Regras que não devem ser desfeitas sem pensar:
 * - Nunca fica sem administrador ativo: não se desativa nem se rebaixa o último.
 * - Ninguém desativa a si mesmo (evita se trancar para fora por engano).
 * - Criar e redefinir geram uma SENHA TEMPORÁRIA, mostrada uma vez ao admin;
 *   a pessoa é obrigada a trocá-la no primeiro acesso.
 * - Redefinir ou desativar desconecta a pessoa de todos os aparelhos.
 */
type Linha = { id: string; email: string; name: string; role: string; created: string; active: number | null; must_change: number | null;
  modules: string | null; phone: string | null; req_name: string | null; req_phone: string | null; req_email: string | null; req_created: string | null };
const PAPEIS = ['admin', 'equipe'] as const;
const erro = (msg: string, status = 400) => Response.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store' } });

async function listar(): Promise<Linha[]> {
  await garantirTabelaStatus();
  const r = await banco().prepare(
    `SELECT u.id,u.email,u.name,u.role,u.created,st.active,st.must_change,p.modules,pf.phone,
            rq.name AS req_name, rq.phone AS req_phone, rq.email AS req_email, rq.created AS req_created
       FROM users u
       LEFT JOIN user_status st ON st.user_id=u.id
       LEFT JOIN user_perms p ON p.user_id=u.id
       LEFT JOIN user_profile pf ON pf.user_id=u.id
       LEFT JOIN profile_requests rq ON rq.user_id=u.id
      ORDER BY u.created`
  ).all<Linha>();
  return r.results || [];
}
const salvos = (l: Linha): unknown => { try { return l.modules ? JSON.parse(l.modules) : undefined; } catch { return []; } };
const ativo = (l: Linha) => l.active !== 0;
const adminsAtivos = (lista: Linha[]) => lista.filter(l => l.role === 'admin' && ativo(l)).length;

export async function GET(request: Request) {
  const admin = await exigirAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const chave = normalizarCodigo((env as unknown as { CHAVE_EMERGENCIA?: string }).CHAVE_EMERGENCIA || '');
    return Response.json({
      usuarios: (await listar()).map(l => ({ id: l.id, email: l.email, name: l.name, role: l.role, created: l.created,
        ativo: ativo(l), trocarSenha: l.must_change === 1, voce: l.id === admin.id,
        telefone: l.phone || '', modulos: modulosDoUsuario(l.role, salvos(l)),
        pedido: l.req_created ? { nome: l.req_name, telefone: l.req_phone, email: l.req_email, criadoEm: l.req_created } : null })),
      modulosDisponiveis: MODULOS,
      chaveEmergencia: chave.length >= 16,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM GET /api/usuarios:', e instanceof Error ? e.message : String(e));
    return erro('Não foi possível carregar os usuários.', 503);
  }
}

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const admin = await exigirAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const c = await request.json() as Record<string, unknown>;
    const acao = String(c.acao || '');
    const lista = await listar();
    const alvo = c.id ? lista.find(l => l.id === String(c.id)) : undefined;
    if (acao !== 'criar' && !alvo) return erro('Usuário não encontrado.', 404);

    if (acao === 'criar') {
      const email = normalizarEmail(c.email), nome = String(c.nome ?? '').trim(), papel = String(c.papel || 'equipe');
      if (!emailValido(email)) return erro('Informe um e-mail válido.');
      if (!nome || nome.length > 200) return erro('Informe o nome.');
      if (!PAPEIS.includes(papel as typeof PAPEIS[number])) return erro('Papel inválido.');
      if (lista.some(l => l.email === email)) return erro('Já existe um usuário com este e-mail.');
      const id = crypto.randomUUID(), senha = senhaTemporaria();
      await banco().prepare('INSERT INTO users (id,email,name,role,password,created) VALUES (?,?,?,?,?,?)')
        .bind(id, email, nome, papel, await hashSenha(senha), new Date().toISOString()).run();
      await definirStatus(id, { active: true, mustChange: true });
      return Response.json({ ok: true, senhaTemporaria: senha, email }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (acao === 'editar') {
      const nome = String(c.nome ?? '').trim(), papel = String(c.papel || alvo!.role);
      if (!nome || nome.length > 200) return erro('Informe o nome.');
      if (!PAPEIS.includes(papel as typeof PAPEIS[number])) return erro('Papel inválido.');
      if (alvo!.role === 'admin' && papel !== 'admin' && ativo(alvo!) && adminsAtivos(lista) <= 1)
        return erro('Este é o único administrador ativo. Promova outra pessoa a administrador antes.');
      await banco().prepare('UPDATE users SET name=?, role=? WHERE id=?').bind(nome, papel, alvo!.id).run();
      return Response.json({ ok: true });
    }

    if (acao === 'redefinir') {
      const senha = senhaTemporaria();
      await banco().prepare('UPDATE users SET password=? WHERE id=?').bind(await hashSenha(senha), alvo!.id).run();
      await definirStatus(alvo!.id, { mustChange: true });
      if (alvo!.id !== admin.id) await encerrarOutrasSessoes(alvo!.id);
      return Response.json({ ok: true, senhaTemporaria: senha, email: alvo!.email }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (acao === 'ativar') {
      const querAtivo = c.ativo === true;
      if (!querAtivo && alvo!.id === admin.id) return erro('Você não pode desativar o seu próprio acesso.');
      if (!querAtivo && alvo!.role === 'admin' && ativo(alvo!) && adminsAtivos(lista) <= 1)
        return erro('Este é o único administrador ativo. Não dá para desativá-lo.');
      await definirStatus(alvo!.id, { active: querAtivo });
      if (!querAtivo) await encerrarOutrasSessoes(alvo!.id);
      return Response.json({ ok: true });
    }

    if (acao === 'permissoes') {
      // Admin tem tudo sempre; permissões só valem para quem é Equipe.
      if (alvo!.role === 'admin') return erro('O administrador acessa tudo. Para limitar, mude o papel para Equipe.');
      if (!Array.isArray(c.modulos)) return erro('Lista de módulos inválida.');
      const modulos = MODULOS.filter(m => (c.modulos as unknown[]).includes(m));
      await banco().prepare('INSERT INTO user_perms (user_id,modules) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET modules=excluded.modules')
        .bind(alvo!.id, JSON.stringify(modulos)).run();
      return Response.json({ ok: true });
    }

    if (acao === 'aprovarPerfil' || acao === 'recusarPerfil') {
      if (!alvo!.req_created) return erro('Não há pedido de mudança para esta pessoa.');
      if (acao === 'aprovarPerfil') {
        const email = normalizarEmail(alvo!.req_email);
        if (!emailValido(email)) return erro('O e-mail pedido é inválido. Recuse o pedido.');
        if (lista.some(l => l.id !== alvo!.id && l.email === email)) return erro('O e-mail pedido já é usado por outra pessoa. Recuse o pedido.');
        await banco().batch([
          banco().prepare('UPDATE users SET name=?, email=? WHERE id=?').bind(String(alvo!.req_name), email, alvo!.id),
          banco().prepare('INSERT INTO user_profile (user_id,phone) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone').bind(alvo!.id, String(alvo!.req_phone || '')),
          banco().prepare('DELETE FROM profile_requests WHERE user_id=?').bind(alvo!.id),
        ]);
      } else {
        await banco().prepare('DELETE FROM profile_requests WHERE user_id=?').bind(alvo!.id).run();
      }
      return Response.json({ ok: true });
    }

    return erro('Ação inválida.');
  } catch (e) {
    console.error('FALHA EM POST /api/usuarios:', e instanceof Error ? e.message : String(e));
    return erro('Não foi possível concluir. Tente de novo.', 503);
  }
}
