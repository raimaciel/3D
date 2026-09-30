import { EMPRESA } from '@/lib/site';

/*
 * sitemap.xml: a lista de páginas do site para o Google (30/09/2026).
 * Hoje o site é uma página só, com as peças dentro dela.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${EMPRESA.endereco}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
