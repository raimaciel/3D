'use client';
/*
 * Ajudas da tela de Precificação, separadas do manager.tsx para ficarem fáceis
 * de achar:
 *   PontosDePartida        — chaveiro, peça técnica, miniatura...: preenche
 *                            peso e tempo típicos para começar a conta.
 *   LerDoFatiador          — puxa peso e tempo do arquivo fatiado.
 *   ClientePediuOutroPreco — "faz por R$ 25?": quanto sobra nesse preço.
 * Nenhuma delas faz conta de preço própria: as contas moram em lib/.
 */
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { lerFatiador } from '@/lib/fatiador';
import { analyzeOffer, type Calculation } from '@/lib/domain';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** 1,5 → "1 h 30 min"; 0,4 → "24 min". */
export function horasPorExtenso(horas: number): string {
  const total = Math.round(horas * 60), h = Math.floor(total / 60), m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ---------------------------------------------------------------------------
 * Pontos de partida. Números típicos para a A1; servem para começar, não para
 * cobrar. O valor certo vem do fatiador, e o texto da tela diz isso.
 * weight e hours são POR PEÇA, como no resto da tela.
 * ------------------------------------------------------------------------- */
export type PontoDePartida = {
  nome: string; detalhe: string;
  weight: number; hours: number; quantity: number; finishMinutes: number;
};
export const PONTOS_DE_PARTIDA: PontoDePartida[] = [
  { nome: 'Chaveiro', detalhe: '8 g · 25 min', weight: 8, hours: 0.42, quantity: 1, finishMinutes: 2 },
  { nome: 'Lote de chaveiros', detalhe: '20 un · 8 g cada', weight: 8, hours: 0.42, quantity: 20, finishMinutes: 2 },
  { nome: 'Peça técnica', detalhe: '60 g · 3 h', weight: 60, hours: 3, quantity: 1, finishMinutes: 10 },
  { nome: 'Miniatura', detalhe: '20 g · 3 h 30', weight: 20, hours: 3.5, quantity: 1, finishMinutes: 15 },
  { nome: 'Decoração', detalhe: '120 g · 6 h', weight: 120, hours: 6, quantity: 1, finishMinutes: 5 },
];

export function PontosDePartida({ onEscolher }: { onEscolher: (p: PontoDePartida) => void }) {
  return (
    <div className="pontos-partida">
      <span className="pontos-titulo">Começar por um exemplo</span>
      <div className="pontos-lista">
        {PONTOS_DE_PARTIDA.map(p => (
          <button key={p.nome} type="button" onClick={() => onEscolher(p)}>
            <b>{p.nome}</b><small>{p.detalhe}</small>
          </button>
        ))}
      </div>
      <small className="hint">Números típicos, só para começar. Troque pelo peso e tempo do fatiador.</small>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Ler do fatiador. O arquivo é lido aqui no navegador e não é enviado.
 * O fatiador informa o total da MESA; a tela trabalha POR PEÇA. Se havia
 * várias peças na mesa, divide, e a mensagem mostra a conta feita.
 * ------------------------------------------------------------------------- */
export function LerDoFatiador({ onLer }: { onLer: (porPeca: { weight: number; hours: number }) => void }) {
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  async function ler(arquivo: File) {
    setLendo(true); setAviso(null);
    try {
      const r = await lerFatiador(arquivo.name, arquivo.size,
        async (inicio, fim) => new Uint8Array(await arquivo.slice(inicio, fim).arrayBuffer()));
      const weight = Math.round(r.gramas / r.pecas * 100) / 100;
      const hours = Math.round(r.horas / r.pecas * 1000) / 1000;
      onLer({ weight, hours });
      const g = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' g';
      setAviso({ ok: true, texto: r.pecas > 1
        ? `Mesa com ${r.pecas} peças: ${g(r.gramas)} e ${horasPorExtenso(r.horas)} no total. Preenchi ${g(weight)} e ${horasPorExtenso(hours)} por peça.`
        : `Preenchi ${g(weight)} e ${horasPorExtenso(hours)} por peça.` });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : 'Não consegui ler este arquivo.' });
    } finally { setLendo(false); }
  }

  return (
    <div className="ler-fatiador">
      <label className="file-chip" htmlFor="lerFatiador"><FileUp size={15} /> {lendo ? 'Lendo…' : 'Ler peso e tempo do fatiador'}</label>
      <input id="lerFatiador" type="file" accept=".3mf,.gcode" hidden disabled={lendo}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ler(f); }} />
      {aviso
        ? <p className={aviso.ok ? 'hint' : 'inline-note'} role={aviso.ok ? 'status' : 'alert'}>{aviso.texto}</p>
        : <p className="hint">No Bambu Studio: fatie e use Arquivo → Exportar → Exportar arquivo fatiado (.gcode.3mf). O arquivo é lido aqui mesmo e não é enviado.</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * O cliente pediu outro preço. Não muda o preço calculado; só mostra quanto
 * sobra se aceitar, descontando as mesmas taxas.
 * ------------------------------------------------------------------------- */
export function ClientePediuOutroPreco({ c, precoMinimo }: { c: Calculation; precoMinimo: number }) {
  const [texto, setTexto] = useState('');
  // "25,50" e "1.250,00" (jeito brasileiro) e também "25.5" viram número.
  const limpo = texto.replace(/[^\d,.]/g, '');
  const preco = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  const valido = texto.trim() !== '' && Number.isFinite(preco) && preco > 0;
  const a = valido ? analyzeOffer(c, preco) : null;

  return (
    <div className="outro-preco">
      <b>O cliente pediu outro preço?</b>
      <p>Digite o valor por peça e veja quanto sobra, já descontadas as taxas.</p>
      <label className="field"><span>Preço pedido, por peça (R$)</span>
        <input inputMode="decimal" placeholder="Ex: 25,00" value={texto} onChange={e => setTexto(e.target.value)} />
      </label>
      {a && (
        <div className="outro-preco-resultado">
          <div><span>Lucro por peça</span><b className={a.unitProfit < 0 ? 'negative' : ''}>{brl(a.unitProfit)}</b></div>
          {c.quantity > 1 && <div><span>Lucro do lote ({c.quantity} peças)</span><b className={a.profit < 0 ? 'negative' : ''}>{brl(a.profit)}</b></div>}
          <div><span>ROI real</span><b className={a.roiReal < 0 ? 'negative' : ''}>{Math.round(a.roiReal).toLocaleString('pt-BR')}%</b></div>
          <p className={preco < precoMinimo ? 'inline-note' : 'hint'} role={preco < precoMinimo ? 'alert' : undefined}>
            {preco < precoMinimo
              ? `Abaixo do preço mínimo de ${brl(precoMinimo)}: você paga para fazer esta peça.`
              : a.difference < 0
                ? `${brl(-a.difference)} abaixo do preço calculado, mas ainda com lucro.`
                : `${brl(a.difference)} acima do preço calculado.`}
          </p>
        </div>
      )}
    </div>
  );
}
