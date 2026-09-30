import { env } from 'cloudflare:workers';
import { readWorkspace } from '@/lib/store';
import { fotoEhPublica } from '@/lib/site';

/*
 * Foto da vitrine do site público (30/09/2026). SEM login, mas só entrega a
 * foto se ela for de um produto marcado "Mostrar no site". Qualquer outro
 * arquivo (STL de cliente, foto de produção, logo) continua na rota com login,
 * /api/files/<id>. Tirou o produto do site, a foto some daqui também.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response('Não encontrado', { status: 404 });
  try {
    const { state } = await readWorkspace();
    if (!fotoEhPublica(state.products, id)) return new Response('Não encontrado', { status: 404 });
    const f = await (env as unknown as { BUCKET: R2Bucket }).BUCKET.get(id);
    if (!f) return new Response('Não encontrado', { status: 404 });
    const tipo = f.httpMetadata?.contentType || '';
    if (!tipo.startsWith('image/')) return new Response('Não encontrado', { status: 404 });
    return new Response(f.body, { headers: {
      'Content-Type': tipo,
      'X-Content-Type-Options': 'nosniff',
      // Pública e pode ficar em cache por 1 hora (a foto muda pouco).
      'Cache-Control': 'public, max-age=3600',
    } });
  } catch {
    return new Response('Indisponível', { status: 503 });
  }
}
