import { env } from 'cloudflare:workers';
import { exigirUsuario } from '@/lib/sessao';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Foto de peça e logo são dados da empresa: exigem sessão como o resto.
  const usuario = await exigirUsuario(request);
  if (usuario instanceof Response) return usuario;
  const { id } = await params;
  if (!/^[a-f0-9-]+$/.test(id)) return new Response('Não encontrado', { status: 404 });
  try {
    const f = await (env as unknown as { BUCKET: R2Bucket }).BUCKET.get(id);
    if (!f) return new Response('Não encontrado', { status: 404 });
    return new Response(f.body, { headers: {
      'Content-Type': f.httpMetadata?.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600'
    } });
  } catch { return new Response('Indisponível', { status: 503 }); }
}
