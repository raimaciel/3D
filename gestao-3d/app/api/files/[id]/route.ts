import { env } from 'cloudflare:workers';
import { exigirUsuario } from '@/lib/sessao';
import { nomeSeguro } from '@/lib/arquivos';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Foto de peça, logo e arquivo 3D do cliente são dados da empresa: exigem sessão.
  const usuario = await exigirUsuario(request);
  if (usuario instanceof Response) return usuario;
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response('Não encontrado', { status: 404 });
  try {
    const f = await (env as unknown as { BUCKET: R2Bucket }).BUCKET.get(id);
    if (!f) return new Response('Não encontrado', { status: 404 });

    const tipo = f.httpMetadata?.contentType || 'application/octet-stream';
    const nome = nomeSeguro(f.customMetadata?.nome || id);
    // Imagem aparece na tela; arquivo 3D o navegador não sabe mostrar, então
    // baixa com o nome original em vez de virar lixo na aba.
    const comoAnexo = f.customMetadata?.categoria === 'modelo' || !tipo.startsWith('image/');

    return new Response(f.body, { headers: {
      'Content-Type': tipo,
      'Content-Disposition': `${comoAnexo ? 'attachment' : 'inline'}; filename="${nome}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600'
    } });
  } catch { return new Response('Indisponível', { status: 503 }); }
}
