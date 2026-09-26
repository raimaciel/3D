import { env } from 'cloudflare:workers';
import { exigirEquipe, origemInvalida } from '@/lib/sessao';
import { aceitar, conteudoCombina, nomeSeguro } from '@/lib/arquivos';

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  const usuario = await exigirEquipe(request);
  if (usuario instanceof Response) return usuario;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (!(f instanceof File)) return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });

    const veredito = aceitar(f.name, f.size);
    if (!veredito.ok) return Response.json({ error: veredito.erro }, { status: 400 });

    // Só o começo do arquivo entra na memória. O resto vai direto para o R2 em
    // fluxo — um STL de 50 MB não pode ser carregado inteiro aqui.
    const inicio = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
    if (!conteudoCombina(veredito.extensao, inicio, f.size))
      return Response.json(
        { error: `O conteúdo não parece um arquivo .${veredito.extensao} válido. Confira se mandou o arquivo certo.` },
        { status: 400 });

    const nome = nomeSeguro(f.name);
    const key = crypto.randomUUID();
    await (env as unknown as { BUCKET: R2Bucket }).BUCKET.put(key, f.stream(), {
      httpMetadata: { contentType: veredito.contentType },
      customMetadata: { nome, categoria: veredito.categoria }
    });
    return Response.json({ url: '/api/files/' + key, nome, categoria: veredito.categoria, tamanho: f.size });
  } catch {
    return Response.json({ error: 'Não foi possível enviar o arquivo.' }, { status: 503 });
  }
}
