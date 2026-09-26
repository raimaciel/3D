import { usuarioDaRequisicao, existeAlgumUsuario } from '@/lib/sessao';

/** Quem sou eu. A tela chama isto ao abrir para saber se mostra login ou sistema. */
export async function GET(request: Request) {
  try {
    const usuario = await usuarioDaRequisicao(request);
    // Só informa que falta configurar quando ninguém está logado; assim a tela
    // sabe mostrar "criar primeiro acesso" em vez de "entrar".
    const precisaConfigurar = usuario ? false : !(await existeAlgumUsuario());
    return Response.json({ usuario, precisaConfigurar }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('FALHA EM /api/auth/me:', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Não foi possível verificar seu acesso.' }, { status: 503 });
  }
}
