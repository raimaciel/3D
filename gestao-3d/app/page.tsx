import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Acesso from './acesso';
import { EmBreve } from './em-breve';
import { SitePublico } from './site-publico';
import { EMPRESA, qualPagina, type Pagina } from '@/lib/site';

/*
 * A porta de entrada decide pelo endereço digitado (lib/site.ts, qualPagina):
 *   fabricando3d.com.br / www.   -> "Em breve" (no Google)
 *   previa.fabricando3d.com.br   -> site completo em stand-by (fora do Google)
 *   qualquer outro               -> a gestão, com login (fora do Google)
 *
 * `force-dynamic`: a página é montada a cada visita, porque depende do
 * endereço e das peças cadastradas; não pode ser "congelada" na construção.
 */
export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function pagina(searchParams: Props['searchParams']): Promise<Pagina> {
  const host = (await headers()).get('host');
  return qualPagina(host, searchParams ? await searchParams : undefined);
}

const TITULO_SITE = 'Fabricando 3D | Impressão 3D em Fortaleza';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = await pagina(searchParams);
  if (p === 'embreve') {
    const descricao = 'Fabricando 3D: impressão 3D em Fortaleza. Novo site em breve. Faça seu orçamento pelo WhatsApp (85) 99839-3893.';
    return {
      title: TITULO_SITE,
      description: descricao,
      alternates: { canonical: EMPRESA.endereco },
      robots: { index: true, follow: true },
      openGraph: { title: TITULO_SITE, description: descricao, url: EMPRESA.endereco, siteName: EMPRESA.nome, locale: 'pt_BR', type: 'website' },
    };
  }
  if (p === 'previa') {
    // Prévia: aberta a quem tiver o link, mas FORA do Google (decisão do dono).
    return {
      title: 'Prévia | ' + TITULO_SITE,
      description: 'Prévia do novo site da Fabricando 3D, em construção.',
      robots: { index: false, follow: false },
    };
  }
  // A gestão NÃO vai para o Google.
  return {
    title: 'Gestão 3D | Produção e negócios',
    description: 'Sistema interno da Fabricando 3D.',
    robots: { index: false, follow: false },
  };
}

export default async function Home({ searchParams }: Props) {
  const p = await pagina(searchParams);
  if (p === 'embreve') return <EmBreve />;
  if (p === 'previa') return <SitePublico previa />;
  return <Acesso />;
}
