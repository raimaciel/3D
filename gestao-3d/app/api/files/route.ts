import { env } from 'cloudflare:workers';
import { exigirEquipe, origemInvalida } from '@/lib/sessao';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAX = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const usuario = await exigirEquipe(request);
  if (usuario instanceof Response) return usuario;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (!(f instanceof File) || f.size > TAMANHO_MAX || !TIPOS.includes(f.type))
      return Response.json({ error: 'Use JPG, PNG ou WebP de até 5 MB.' }, { status: 400 });
    const key = crypto.randomUUID();
    await (env as unknown as { BUCKET: R2Bucket }).BUCKET.put(key, await f.arrayBuffer(),
      { httpMetadata: { contentType: f.type } });
    return Response.json({ url: '/api/files/' + key });
  } catch {
    return Response.json({ error: 'Não foi possível enviar a foto.' }, { status: 503 });
  }
}
