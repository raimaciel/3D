import { ehEnderecoDoSite, EMPRESA } from '@/lib/site';

/*
 * robots.txt: o que o Google pode ler (30/09/2026).
 * No site: tudo, e onde fica a lista de páginas. Na gestão: nada.
 */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const site = ehEnderecoDoSite(new URL(request.url).host) || ehEnderecoDoSite(request.headers.get('host'));
  const texto = site
    ? `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/site/\n\nSitemap: ${EMPRESA.endereco}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
