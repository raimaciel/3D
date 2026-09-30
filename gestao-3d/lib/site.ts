/*
 * Regras do site público da Fabricando 3D (30/09/2026).
 *
 * O MESMO sistema responde por dois endereços:
 *   fabricando3d.com.br (e www.)  -> o site, aberto a todos e ao Google
 *   gestao3d.fabricando3d.com.br  -> a gestão, com login e fora do Google
 * Qualquer outro endereço (o workers.dev, localhost) mostra a gestão; para
 * ver o site nesses, usa-se ?site=1 (só para conferir, o site é público mesmo).
 *
 * A vitrine sai dos Produtos marcados com "Mostrar no site". Daqui só sai o
 * que é público: NUNCA custo, peso, tempo ou qualquer dado da gestão.
 *
 * Nada de tela nem de banco aqui, para testar no Node (lib/site.teste.ts).
 */

export const EMPRESA = {
  nome: 'Fabricando 3D',
  whatsapp: '5585998393893',          // (85) 99839-3893, com 55 do Brasil
  whatsappVisivel: '(85) 99839-3893',
  instagram: 'fabricando3d.ofc',
  cidade: 'Fortaleza',
  estado: 'CE',
  atendimento: 'Fortaleza e região metropolitana, com envio para todo o Brasil',
  endereco: 'https://fabricando3d.com.br',
} as const;

const HOSTS_DO_SITE = ['fabricando3d.com.br', 'www.fabricando3d.com.br'];

/** O endereço digitado é o do site? `host` pode vir com porta. */
export function ehEnderecoDoSite(host: string | null | undefined): boolean {
  const h = String(host || '').toLowerCase().trim().replace(/:\d+$/, '');
  return HOSTS_DO_SITE.includes(h);
}

export type ProdutoDoSite = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  cor: string;
  /** null = "Peça seu orçamento". */
  preco: number | null;
  /** Endereço público da foto, ou null. */
  foto: string | null;
};

/** Id do arquivo de uma foto guardada como "/api/files/<uuid>", ou null. */
export function idDaFoto(url: unknown): string | null {
  const m = /^\/api\/files\/([a-f0-9-]{36})$/.exec(String(url || ''));
  return m ? m[1] : null;
}

/**
 * Os produtos que aparecem na vitrine, só com os campos públicos.
 * A foto troca de endereço: /api/files/ (com login) vira /api/site/foto/
 * (pública, mas que só entrega foto de produto marcado para o site).
 */
export function produtosDoSite(produtos: unknown): ProdutoDoSite[] {
  if (!Array.isArray(produtos)) return [];
  return produtos
    .filter(p => p && typeof p === 'object' && (p as { showOnSite?: unknown }).showOnSite === true)
    .map(p => {
      const x = p as Record<string, unknown>;
      const preco = Number(x.sitePrice);
      const foto = idDaFoto(x.photo);
      return {
        id: String(x.id || ''),
        nome: String(x.name || '').trim(),
        categoria: String(x.category || '').trim(),
        descricao: String(x.description || '').trim(),
        cor: String(x.color || '').trim(),
        preco: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) / 100 : null,
        foto: foto ? `/api/site/foto/${foto}` : null,
      };
    })
    .filter(p => p.id && p.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** A foto com este id pertence a um produto que está no site? */
export function fotoEhPublica(produtos: unknown, id: string): boolean {
  return produtosDoSite(produtos).some(p => p.foto === `/api/site/foto/${id}`);
}

/** Link do WhatsApp com a mensagem já escrita. */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${EMPRESA.whatsapp}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/** A mensagem do botão "Quero este" de cada peça. */
export function mensagemDaPeca(nome: string): string {
  return `Olá! Vi no site da Fabricando 3D a peça "${nome}" e tenho interesse. Pode me passar mais informações?`;
}
