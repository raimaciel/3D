import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Acesso from './acesso';
import { SitePublico } from './site-publico';
import { EMPRESA, ehEnderecoDoSite } from '@/lib/site';

/*
 * A porta de entrada decide pelo endereço digitado (30/09/2026):
 *   fabricando3d.com.br / www.  -> o site público (lib/site.ts)
 *   qualquer outro              -> a gestão, com login
 * `?site=1` mostra o site em qualquer endereço, só para conferir no
 * computador; o site é público de qualquer forma.
 *
 * `force-dynamic`: a página é montada a cada visita, porque depende do
 * endereço e das peças cadastradas; não pode ser "congelada" na construção.
 */
export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function ehSite(searchParams: Props['searchParams']): Promise<boolean> {
  const host = (await headers()).get('host');
  const sp = searchParams ? await searchParams : {};
  return ehEnderecoDoSite(host) || sp.site !== undefined;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (await ehSite(searchParams)) {
    const titulo = 'Fabricando 3D | Impressão 3D em Fortaleza';
    const descricao = 'Impressão 3D e modelagem 3D sob encomenda em Fortaleza e região, com envio para todo o Brasil. Chaveiros, peças técnicas, miniaturas e decoração em PLA, PETG e ABS/ASA. Orçamento pelo WhatsApp.';
    return {
      title: titulo,
      description: descricao,
      alternates: { canonical: EMPRESA.endereco },
      robots: { index: true, follow: true },
      openGraph: { title: titulo, description: descricao, url: EMPRESA.endereco, siteName: EMPRESA.nome, locale: 'pt_BR', type: 'website' },
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
  if (await ehSite(searchParams)) return <SitePublico />;
  return <Acesso />;
}
