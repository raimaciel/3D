import { readWorkspace } from '@/lib/store';
import { applyAction } from '@/lib/domain';
import { banco, exigirEquipe, origemInvalida } from '@/lib/sessao';
import { filtrarEstado, podeAcao } from '@/lib/permissoes';

/*
 * Os dados da gestão. Desde 30/09/2026, cada pessoa recebe só o que os seus
 * módulos permitem (filtrarEstado) e só altera o que eles permitem (podeAcao).
 * É aqui que a permissão vale de verdade; o menu escondido é só cortesia.
 */
export async function GET(request: Request) {
  const usuario = await exigirEquipe(request);
  if (usuario instanceof Response) return usuario;
  try {
    const w = await readWorkspace();
    return Response.json({ ...w, state: filtrarEstado(w.state, usuario.modulos || []) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Não foi possível carregar os dados. Tente novamente.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const usuario = await exigirEquipe(request);
  if (usuario instanceof Response) return usuario;
  try {
    if (Number(request.headers.get('content-length') || 0) > 1000000)
      return Response.json({ error: 'Dados muito grandes.' }, { status: 413 });
    const body: any = await request.json(), current = await readWorkspace();
    const acao = body?.action;
    if (!acao || !podeAcao(String(acao.type), acao.kind ? String(acao.kind) : undefined, usuario.modulos || []))
      return Response.json({ error: 'Sua conta não tem permissão para fazer isso. Fale com o administrador.' }, { status: 403 });
    if (body.revision !== current.revision)
      return Response.json({ error: 'Os dados mudaram em outro acesso. Atualize e tente novamente.' }, { status: 409 });
    const state = applyAction(current.state, acao);
    const r = await banco().prepare(
      'UPDATE workspace SET data=?, revision=revision+1, updated=? WHERE id=? AND revision=?'
    ).bind(JSON.stringify(state), new Date().toISOString(), 'company', current.revision).run();
    if (!r.meta.changes)
      return Response.json({ error: 'Outra alteração foi salva. Atualize e tente novamente.' }, { status: 409 });
    return Response.json({ state: filtrarEstado(state, usuario.modulos || []), revision: current.revision + 1 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    if (e?.issues) return Response.json(
      { error: 'Verifique os campos: ' + e.issues.map((x: any) => x.path.join('.') + ' ' + x.message).join('; ') },
      { status: 400 });
    console.error(e);
    return Response.json({ error: e?.message || 'Não foi possível salvar. Seus campos foram preservados.' }, { status: 400 });
  }
}
