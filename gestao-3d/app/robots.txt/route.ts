import { EMPRESA, qualPagina } from '@/lib/site';

/*
 * robots.txt: o que o Google pode ler, por endereço (30/09/2026).
 *   fabricando3d.com.br (Em breve): tudo, e onde fica a lista de páginas.
 *   previa. e gestao3d.: nada (a prévia fica fora do Google por decisão do dono).
 */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const noGoogle = qualPagina(request.headers.get('host') || new URL(request.url).host) === 'embreve';
  const texto = noGoogle
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${EMPRESA.endereco}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
