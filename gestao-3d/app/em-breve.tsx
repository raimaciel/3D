/*
 * Página "Em breve" (30/09/2026), em fabricando3d.com.br enquanto o site
 * completo está em stand-by na prévia. Pedido do dono: uma página só, bem
 * chamativa, nas cores da marca, com o nome, "Impressão 3D em Fortaleza",
 * WhatsApp e Instagram, e que APAREÇA NO GOOGLE para começar a divulgar o
 * domínio. Rascunho aprovado por ele.
 *
 * Montada no servidor, sem JavaScript no navegador: os botões são links.
 */
import { Box, MessageCircle } from 'lucide-react';
import { EMPRESA, fichaParaOGoogle, linkWhatsApp } from '@/lib/site';

/** Ícone do Instagram (a biblioteca de ícones não traz mais ícones de marcas). */
function Instagram({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function EmBreve() {
  return (
    <div className="eb">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fichaParaOGoogle()) }} />
      <span className="eb-circulo eb-turquesa" aria-hidden="true" />
      <span className="eb-circulo eb-laranja" aria-hidden="true" />

      <main className="eb-centro">
        <div className="eb-cubo" aria-hidden="true"><Box size={44} strokeWidth={1.6} /></div>
        <h1 className="eb-nome">Fabricando <span>3D</span></h1>
        <p className="eb-selo">EM BREVE</p>
        <h2 className="eb-frase">Nosso novo site está chegando</h2>
        <p className="eb-sub">Impressão 3D em Fortaleza</p>
        <div className="eb-botoes">
          <a className="eb-botao" href={linkWhatsApp('Olá! Vim pelo site da Fabricando 3D e quero fazer um orçamento.')} target="_blank" rel="noopener">
            <MessageCircle size={20} /> Chamar no WhatsApp
          </a>
          <a className="eb-contorno" href={`https://www.instagram.com/${EMPRESA.instagram}/`} target="_blank" rel="noopener">
            <Instagram size={20} /> @{EMPRESA.instagram}
          </a>
        </div>
        <p className="eb-telefone">{EMPRESA.whatsappVisivel}</p>
      </main>
    </div>
  );
}
