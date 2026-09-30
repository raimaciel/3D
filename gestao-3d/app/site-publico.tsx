/*
 * Site público da Fabricando 3D (30/09/2026), em fabricando3d.com.br.
 *
 * Montado NO SERVIDOR (sem 'use client'): o Google recebe a página pronta,
 * com o texto e as peças, que é o que ele precisa para achar o site.
 * Não tem JavaScript no navegador: os botões são links comuns.
 *
 * Aprovado pelo dono em rascunho: azul-marinho e turquesa da marca, com
 * LARANJA FORTE (#E0600B) nos botões; chamada "Sua ideia vira peça de
 * verdade"; cubo turquesa no lugar do logo, até o logo ficar pronto;
 * atendimento em Fortaleza e região, com envio para todo o Brasil.
 * As peças vêm dos Produtos marcados "Mostrar no site" (lib/site.ts).
 */
import { Box, MessageCircle, Package, Ruler, MapPin, Truck } from 'lucide-react';
import { readWorkspace } from '@/lib/store';
import { EMPRESA, linkWhatsApp, mensagemDaPeca, produtosDoSite, type ProdutoDoSite } from '@/lib/site';

/** Ícone do Instagram (a biblioteca de ícones não traz mais ícones de marcas). */
function Instagram({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

async function carregarPecas(): Promise<ProdutoDoSite[]> {
  try { return produtosDoSite((await readWorkspace()).state.products); }
  catch (e) { console.error('Site: não foi possível ler os produtos:', e instanceof Error ? e.message : String(e)); return []; }
}

/** Ficha de "empresa local" para o Google (dados estruturados schema.org). */
function fichaParaOGoogle() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: EMPRESA.nome,
    description: 'Impressão 3D e modelagem 3D sob encomenda em Fortaleza. Peças personalizadas, chaveiros, peças técnicas e decoração em PLA, PETG e ABS/ASA.',
    url: EMPRESA.endereco,
    telephone: '+' + EMPRESA.whatsapp,
    address: { '@type': 'PostalAddress', addressLocality: EMPRESA.cidade, addressRegion: EMPRESA.estado, addressCountry: 'BR' },
    areaServed: [{ '@type': 'City', name: 'Fortaleza' }, { '@type': 'State', name: 'Ceará' }, { '@type': 'Country', name: 'Brasil' }],
    sameAs: [`https://www.instagram.com/${EMPRESA.instagram}/`],
  };
}

export async function SitePublico() {
  const pecas = await carregarPecas();
  const zap = linkWhatsApp('Olá! Vim pelo site da Fabricando 3D e quero fazer um orçamento.');

  return (
    <div className="sp">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fichaParaOGoogle()) }} />

      <header className="sp-topo">
        <a className="sp-logo" href="#inicio" aria-label="Fabricando 3D, início"><span><Box size={20} /></span>Fabricando 3D</a>
        <nav className="sp-menu" aria-label="Seções do site">
          <a href="#pecas">Peças</a><a href="#como-funciona">Como funciona</a><a href="#contato">Contato</a>
        </nav>
        <a className="sp-botao sp-pequeno" href={zap} target="_blank" rel="noopener"><MessageCircle size={16} /> WhatsApp</a>
      </header>

      <main>
        <section className="sp-hero" id="inicio">
          <div>
            <h1>Sua ideia vira <span>peça de verdade</span></h1>
            <p>Impressão 3D e modelagem sob encomenda em {EMPRESA.cidade}. Mande o arquivo pronto ou só a ideia: a gente modela, imprime e entrega.</p>
            <div className="sp-acoes">
              <a className="sp-botao" href={zap} target="_blank" rel="noopener"><MessageCircle size={18} /> Pedir orçamento</a>
              <a className="sp-botao-contorno" href="#pecas">Ver peças</a>
            </div>
            <p className="sp-local"><MapPin size={15} /> {EMPRESA.atendimento}</p>
          </div>
          <div className="sp-arte" aria-hidden="true"><Box size={96} strokeWidth={1.3} /></div>
        </section>

        <section className="sp-secao" id="pecas">
          <h2>Peças</h2>
          <p className="sp-sub">Algumas das que fazemos. Tudo pode ser personalizado: cor, tamanho, nome, logo.</p>
          {pecas.length ? (
            <div className="sp-grade">
              {pecas.map(p => (
                <article className="sp-card" key={p.id}>
                  <div className="sp-foto">
                    {p.foto ? <img src={p.foto} alt={p.nome} loading="lazy" /> : <Box size={34} aria-hidden="true" />}
                  </div>
                  <div className="sp-card-texto">
                    <h3>{p.nome}</h3>
                    {(p.descricao || p.cor) && <p>{[p.descricao, p.cor].filter(Boolean).join(' · ')}</p>}
                    {p.preco !== null ? <span className="sp-preco">{brl(p.preco)}</span> : <span className="sp-orcamento">Peça seu orçamento</span>}
                    <a className="sp-botao sp-cheio" href={linkWhatsApp(mensagemDaPeca(p.nome))} target="_blank" rel="noopener">Quero esta peça</a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sp-vazio">
              <p>Estamos preparando a vitrine. Enquanto isso, conte o que você precisa: fazemos chaveiros, peças técnicas, miniaturas, decoração e peças sob medida.</p>
              <a className="sp-botao" href={zap} target="_blank" rel="noopener"><MessageCircle size={18} /> Falar no WhatsApp</a>
            </div>
          )}
        </section>

        <section className="sp-secao sp-passos-fundo" id="como-funciona">
          <h2>Como funciona</h2>
          <p className="sp-sub">Do jeito que for mais fácil para você.</p>
          <ol className="sp-passos">
            <li><MessageCircle size={24} /><b>1. Conte o que precisa</b><span>Mande o arquivo STL ou 3MF, ou uma foto e a ideia, pelo WhatsApp.</span></li>
            <li><Ruler size={24} /><b>2. Aprove o modelo e o preço</b><span>Se a peça precisar ser modelada, você aprova o modelo antes de imprimir.</span></li>
            <li><Package size={24} /><b>3. Receba a peça</b><span>Imprimimos, damos o acabamento e entregamos em {EMPRESA.cidade} ou enviamos para todo o Brasil.</span></li>
          </ol>
        </section>

        <section className="sp-secao">
          <h2>Materiais</h2>
          <p className="sp-sub">Escolhemos o material certo para o uso da peça.</p>
          <ul className="sp-materiais">
            <li><b>PLA</b><span>Peças decorativas, chaveiros e brindes, em muitas cores.</span></li>
            <li><b>PETG</b><span>Mais resistente, bom para peças de uso e contato com água.</span></li>
            <li><b>ABS / ASA</b><span>Resistência ao calor e ao sol, para peças técnicas.</span></li>
          </ul>
        </section>

        <section className="sp-secao sp-contato" id="contato">
          <h2>Fale com a gente</h2>
          <p className="sp-sub"><Truck size={15} /> {EMPRESA.atendimento}.</p>
          <div className="sp-acoes">
            <a className="sp-botao" href={zap} target="_blank" rel="noopener"><MessageCircle size={18} /> {EMPRESA.whatsappVisivel}</a>
            <a className="sp-botao-contorno sp-escuro" href={`https://www.instagram.com/${EMPRESA.instagram}/`} target="_blank" rel="noopener"><Instagram size={18} /> @{EMPRESA.instagram}</a>
          </div>
        </section>
      </main>

      <footer className="sp-rodape">
        <div><b>Fabricando 3D</b><span>Impressão e modelagem 3D em {EMPRESA.cidade}</span></div>
        <div><span>WhatsApp {EMPRESA.whatsappVisivel}</span><span>Instagram @{EMPRESA.instagram}</span></div>
      </footer>

      <a className="sp-flutuante" href={zap} target="_blank" rel="noopener" aria-label="Falar no WhatsApp"><MessageCircle size={26} /></a>
    </div>
  );
}
