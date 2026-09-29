'use client';
/*
 * Tela de Precificação do Gestão 3D — refeita em 29/09/2026 a partir do
 * rascunho aprovado pelo dono (celular primeiro, computador em três colunas).
 *
 * Esta tela NÃO faz conta de preço: quem calcula é lib/precificacao.ts (o
 * motor testado), por meio de calculate() e analyzeOffer() de lib/domain.ts.
 * Aqui só se junta o que o usuário digita e se mostra o resultado.
 *
 * Escopo dos campos (foi a confusão de escopo que causou o erro de 20x na
 * calculadora antiga, por isso cada rótulo diz o seu):
 *   peso e tempo       -> POR PEÇA
 *   acabamento         -> por peça (multiplica pela quantidade)
 *   preparo            -> uma vez no trabalho
 *   modelagem          -> uma vez no pedido, com valor de hora próprio
 *   embalagem          -> por peça
 */
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Paperclip, Plus, Trash2 } from 'lucide-react';
import {
  analyzeOffer, calculate, calculationSchema, custoInsumosPorPeca, defaults,
  type Arquivo, type Calculation, type Entity, type Kind, type State,
} from '@/lib/domain';
import { InputDinheiro } from './campo-dinheiro';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** 1,5 -> "1 h 30 min"; 0,42 -> "25 min". */
function horasPorExtenso(horas: number): string {
  const total = Math.round(horas * 60), h = Math.floor(total / 60), m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Hora de máquina da impressora: a digitada, ou valor pago ÷ vida útil. */
function horaDeMaquina(p: Entity): number {
  if (Number(p.machineRate) > 0) return Number(p.machineRate);
  return Number(p.value) > 0 && Number(p.lifeHours) > 0 ? Number(p.value) / Number(p.lifeHours) : 0;
}

// Números típicos da A1, só para começar. O rótulo da tela diz isso.
const EXEMPLOS = [
  { nome: 'Chaveiro', peso: 8, horas: 0.42 },
  { nome: 'Peça técnica', peso: 60, horas: 3 },
  { nome: 'Miniatura', peso: 20, horas: 3.5 },
  { nome: 'Decoração', peso: 120, horas: 6 },
];
const ROIS = [20, 30, 35, 50, 100, 150, 200];

/* ------------------------------------------------------------------------ */
/* Campos                                                                   */
/* ------------------------------------------------------------------------ */

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children: ReactNode }) {
  return <label className="field"><span>{rotulo}</span>{children}{dica && <small>{dica}</small>}</label>;
}

function Numero({ rotulo, valor, aoMudar, dica, passo = 'any', min = 0 }:
  { rotulo: string; valor: number; aoMudar: (v: number) => void; dica?: ReactNode; passo?: string; min?: number }) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <input type="number" inputMode="decimal" min={min} step={passo}
        value={Number.isFinite(valor) ? valor : 0}
        onChange={e => aoMudar(e.target.value === '' ? 0 : Number(e.target.value))} />
    </Campo>
  );
}

/**
 * Tempo em HORAS e MINUTOS, como o fatiador mostra. Existe porque "1,45" num
 * campo único vira 1 h 27 min (1,45 hora), e não 1 h 45 min: o dono caiu nisso.
 * Guarda em horas decimais, que é o que o motor usa.
 */
function Tempo({ rotulo, horas, aoMudar, dica }: { rotulo: string; horas: number; aoMudar: (h: number) => void; dica?: ReactNode }) {
  const total = Math.round((Number.isFinite(horas) ? horas : 0) * 60);
  const h = Math.floor(total / 60), m = total % 60;
  const inteiro = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <div className="pz-tempo">
        <input type="number" inputMode="numeric" min={0} step="1" aria-label={rotulo + ', horas'} value={h}
          onChange={e => aoMudar(inteiro(e.target.value) + m / 60)} /><span>h</span>
        <input type="number" inputMode="numeric" min={0} max={59} step="1" aria-label={rotulo + ', minutos'} value={m}
          onChange={e => aoMudar(h + Math.min(59, inteiro(e.target.value)) / 60)} /><span>min</span>
      </div>
    </Campo>
  );
}

/** Campo de dinheiro com a máscara brasileira ("R$ 5.242,20" enquanto digita). */
function Dinheiro({ rotulo, valor, aoMudar, dica, casas = 2 }: { rotulo: string; valor: number; aoMudar: (v: number) => void; dica?: ReactNode; casas?: number }) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <InputDinheiro valor={valor} aoMudar={aoMudar} casas={casas} />
    </Campo>
  );
}

function Secao({ titulo, resumo, children }: { titulo: string; resumo: string; children: ReactNode }) {
  return (
    <details className="pz-secao">
      <summary><span>{titulo}</span><small>{resumo}</small><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="pz-campos">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------------ */
/* Tela                                                                     */
/* ------------------------------------------------------------------------ */

type ItemCarrinho = {
  name: string; category: string; materialId: string; printerId: string;
  calculation: Calculation; arquivos: Arquivo[];
};

export function Precificacao({ s, ocupado, salvar, enviarArquivo, abrirCadastro, irPara }: {
  s: State;
  ocupado: boolean;
  salvar: (acao: unknown) => Promise<boolean>;
  enviarArquivo: (f: File) => Promise<Arquivo>;
  abrirCadastro: (k: Kind) => void;
  irPara: (pagina: string) => void;
}) {
  const [c, setC] = useState<Calculation>({ ...defaults });
  const [nome, setNome] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [outroPreco, setOutroPreco] = useState(0);
  // "peca": digita-se peso e tempo de UMA peça. "lote": digita-se o total do
  // lote (a mesa cheia do fatiador) e a tela divide pela quantidade. O motor
  // sempre recebe POR PEÇA; a divisão mora só aqui.
  const [modo, setModo] = useState<'peca' | 'lote'>('peca');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = useState('');
  const [prazo, setPrazo] = useState(hoje());
  const [obs, setObs] = useState('');

  const muda = <K extends keyof Calculation>(k: K, v: Calculation[K]) => setC(x => ({ ...x, [k]: v }));

  // Os padrões da empresa (Configurações) entram quando os dados carregam.
  const cfg = s.settings;
  useEffect(() => {
    setC(x => ({ ...x, energyRate: cfg.energyRate, laborRate: cfg.laborRate,
      maintenance: cfg.maintenance, paintRate: cfg.paintRate, machineRate: x.machineRate || cfg.machineRate }));
  }, [cfg.energyRate, cfg.laborRate, cfg.maintenance, cfg.paintRate, cfg.machineRate]);

  function escolherMaterial(m: Entity) {
    setMaterialId(m.id); muda('kgPrice', Number(m.kgPrice) || 0);
  }
  function escolherImpressora(p: Entity) {
    setPrinterId(p.id);
    setC(x => ({ ...x, power: Number(p.power) || 0, machineRate: horaDeMaquina(p) }));
  }

  // Insumos da peça. O custo por unidade é copiado do cadastro AGORA: mudar o
  // preço do insumo depois não mexe em orçamento já salvo.
  function adicionarInsumo(id: string) {
    const x = (s.supplies || []).find(i => i.id === id);
    if (!x) return;
    setC(v => {
      const ja = v.supplies.findIndex(i => i.id === id);
      if (ja >= 0) return { ...v, supplies: v.supplies.map((i, k) => k === ja ? { ...i, qty: i.qty + 1 } : i) };
      return { ...v, supplies: [...v.supplies, { id: x.id, name: String(x.name), kind: x.kind === 'embalagem' ? 'embalagem' : 'acabamento', qty: 1, unitCost: Number(x.unitCost) || 0 }] };
    });
  }
  /** Muda a quantidade por peça; -1 tira o insumo da peça. */
  function mudaInsumo(indice: number, quantidade: number) {
    setC(v => ({ ...v, supplies: quantidade < 0 ? v.supplies.filter((_, k) => k !== indice) : v.supplies.map((i, k) => k === indice ? { ...i, qty: quantidade } : i) }));
  }

  // Com um cadastro só (a A1, um filamento), já vem escolhido.
  useEffect(() => { if (!printerId && s.printers.length === 1) escolherImpressora(s.printers[0]); }, [s.printers]);
  useEffect(() => { if (!materialId && s.materials.length === 1) escolherMaterial(s.materials[0]); }, [s.materials]);

  const r = calculate(c);
  const oferta = outroPreco;
  const analise = oferta > 0 ? analyzeOffer(c, oferta) : null;
  const horasTotais = c.hours * c.quantity;
  const semCadastro = !s.materials.length || !s.printers.length;

  async function anexar(f: File) {
    setEnviando(true);
    try { const a = await enviarArquivo(f); setArquivos(v => [...v, a]); toast.success(a.nome + ' anexado'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível enviar o arquivo.'); }
    finally { setEnviando(false); }
  }

  function adicionar() {
    if (!nome.trim()) { toast.error('Dê um nome para a peça.'); return; }
    if (!materialId || !printerId) { toast.error('Escolha o filamento e a impressora.'); return; }
    const ok = calculationSchema.safeParse(c);
    if (!ok.success) { toast.error('Confira os números: há algum valor inválido.'); return; }
    const material = s.materials.find(m => m.id === materialId);
    setCarrinho(v => [...v, { name: nome.trim(), category: String(material?.type || 'Personalizados') || 'Personalizados',
      materialId, printerId, calculation: structuredClone(c), arquivos }]);
    setArquivos([]); setOutroPreco(0);
    toast.success('Peça adicionada ao orçamento');
  }

  async function salvarOrcamento() {
    if (!carrinho.length) { toast.error('Adicione pelo menos uma peça.'); return; }
    if (!cliente) { toast.error('Escolha o cliente.'); return; }
    if (await salvar({ type: 'quote', data: { customerId: cliente, date: hoje(), due: prazo, notes: obs, items: carrinho } })) {
      setCarrinho([]); setObs(''); irPara('Orçamentos');
    }
  }

  const nomeMaterial = (m: Entity) => [m.type || m.name, m.color, m.brand].filter(Boolean).join(' · ');
  const nomeImpressora = (p: Entity) => [p.name, p.model].filter(Boolean).join(' · ');

  return (
    <div className="pz">
      <div className="pz-entrada">
        {semCadastro && (
          <div className="inline-note">
            Para calcular com os seus valores, cadastre {!s.materials.length && 'o filamento'}
            {!s.materials.length && !s.printers.length && ' e '}{!s.printers.length && 'a impressora'}.{' '}
            {!s.materials.length && <button className="text-btn" onClick={() => abrirCadastro('materials')}>Cadastrar filamento</button>}{' '}
            {!s.printers.length && <button className="text-btn" onClick={() => abrirCadastro('printers')}>Cadastrar impressora</button>}
          </div>
        )}

        <div className="panel">
          <p className="pz-rotulo">Começar por um exemplo <small>números típicos, só para começar</small></p>
          <div className="pz-chips">
            {EXEMPLOS.map(e => (
              <button key={e.nome} type="button" onClick={() => { setC(x => ({ ...x, weight: e.peso, hours: e.horas })); if (!nome.trim()) setNome(e.nome); }}>
                {e.nome}
              </button>
            ))}
            <button type="button" onClick={() => { setC(x => ({ ...x, weight: 0, hours: 0 })); setNome(''); document.getElementById('pzNome')?.focus(); }}>
              Outro
            </button>
          </div>

          <Campo rotulo="Nome da peça">
            <input id="pzNome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Digite o nome da peça" />
          </Campo>

          <div className="pz-grade2">
            <Campo rotulo="Filamento">
              <select className="select-trigger" value={materialId}
                onChange={e => { const m = s.materials.find(x => x.id === e.target.value); if (m) escolherMaterial(m); else setMaterialId(''); }}>
                <option value="">{s.materials.length ? 'Escolha o filamento' : 'Nenhum filamento cadastrado'}</option>
                {s.materials.map(m => <option key={m.id} value={m.id}>{nomeMaterial(m)} — {brl(Number(m.kgPrice) || 0)}/kg</option>)}
              </select>
            </Campo>
            <Campo rotulo="Impressora">
              <select className="select-trigger" value={printerId}
                onChange={e => { const p = s.printers.find(x => x.id === e.target.value); if (p) escolherImpressora(p); else setPrinterId(''); }}>
                <option value="">{s.printers.length ? 'Escolha a impressora' : 'Nenhuma impressora cadastrada'}</option>
                {s.printers.map(p => <option key={p.id} value={p.id}>{nomeImpressora(p)} — {Number(p.power) || 0} W</option>)}
              </select>
            </Campo>
          </div>

          <p className="pz-rotulo">Informar</p>
          <div className="pz-chips">
            <button type="button" aria-pressed={modo === 'peca'} onClick={() => setModo('peca')}>Por peça</button>
            <button type="button" aria-pressed={modo === 'lote'} onClick={() => setModo('lote')}>Por lote</button>
          </div>
          {modo === 'peca' ? (
            <div className="pz-grade3">
              <Numero rotulo="Peso por peça (g)" valor={c.weight} aoMudar={v => muda('weight', v)} passo="1" />
              <Tempo rotulo="Tempo por peça" horas={c.hours} aoMudar={v => muda('hours', v)} />
              <Numero rotulo="Quantidade" valor={c.quantity} aoMudar={v => muda('quantity', Math.max(1, Math.round(v) || 1))} passo="1" min={1} />
            </div>
          ) : (
            <>
              <div className="pz-grade3">
                <Numero rotulo="Peso do lote (g)" valor={Math.round(c.weight * c.quantity * 100) / 100}
                  aoMudar={v => muda('weight', v / c.quantity)} passo="1" />
                <Tempo rotulo="Tempo do lote" horas={c.hours * c.quantity} aoMudar={v => muda('hours', v / c.quantity)} />
                <Numero rotulo="Peças no lote" valor={c.quantity} passo="1" min={1}
                  aoMudar={v => {
                    // Mudar a quantidade não muda o total do lote: redivide.
                    const q = Math.max(1, Math.round(v) || 1);
                    setC(x => ({ ...x, quantity: q, weight: x.weight * x.quantity / q, hours: x.hours * x.quantity / q }));
                  }} />
              </div>
              <p className="pz-divisao">
                = {(Math.round(c.weight * 100) / 100).toLocaleString('pt-BR')} g e {horasPorExtenso(c.hours)} por peça
              </p>
            </>
          )}

          <p className="pz-rotulo">Lucro sobre o custo (ROI)</p>
          <div className="pz-chips">
            {ROIS.map(v => <button key={v} type="button" aria-pressed={c.roi === v} onClick={() => muda('roi', v)}>{v}%</button>)}
            <input className="pz-roi" type="number" min={0} step="1" aria-label="Outro ROI (%)" value={c.roi}
              onChange={e => muda('roi', Number(e.target.value) || 0)} />
          </div>

          <div className="pz-anexo">
            <label className="btn secondary small" htmlFor="pzAnexo"><Paperclip size={15} /> {enviando ? 'Enviando…' : 'Anexar arquivo do cliente'}</label>
            <input id="pzAnexo" type="file" hidden accept=".stl,.3mf,image/png,image/jpeg,image/webp" disabled={enviando}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) anexar(f); }} />
            {arquivos.map((a, i) => (
              <span key={a.url} className="badge">{a.nome}
                <button aria-label={'Remover ' + a.nome} onClick={() => setArquivos(v => v.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
              </span>
            ))}
          </div>
        </div>

        <Secao titulo="Máquina e energia" resumo={`${c.power} W · ${brl(c.energyRate)}/kWh · máquina ${brl(c.machineRate)}/h`}>
          <Numero rotulo="Potência (W)" valor={c.power} aoMudar={v => muda('power', v)} passo="1" dica="Vem da impressora escolhida." />
          <Dinheiro rotulo="Tarifa de energia (R$/kWh)" valor={c.energyRate} aoMudar={v => muda('energyRate', v)} casas={3} dica="O padrão fica em Configurações." />
          <Dinheiro rotulo="Hora de máquina (R$/h)" valor={c.machineRate} aoMudar={v => muda('machineRate', v)} dica="Valor pago na impressora ÷ vida útil." />
          <Numero rotulo="Manutenção (%)" valor={c.maintenance} aoMudar={v => muda('maintenance', v)} dica="Sobre filamento + energia." />
        </Secao>

        <Secao titulo="Mão de obra e modelagem" resumo={`${brl(c.laborRate)}/h · preparo ${c.setupMinutes} min · acabamento ${c.finishMinutes} min`}>
          <Dinheiro rotulo="Valor da sua hora (R$/h)" valor={c.laborRate} aoMudar={v => muda('laborRate', v)} />
          <Numero rotulo="Preparo, uma vez (min)" valor={c.setupMinutes} aoMudar={v => muda('setupMinutes', v)} passo="1" dica="Fatiar, montar a mesa. Não multiplica." />
          <Numero rotulo="Acabamento, por peça (min)" valor={c.finishMinutes} aoMudar={v => muda('finishMinutes', v)} passo="1" dica="Tirar suporte, lixar. Multiplica pela quantidade." />
          <Numero rotulo="Modelagem, uma vez no pedido (h)" valor={c.modelingHours} aoMudar={v => muda('modelingHours', v)} passo="0.5" />
          <Dinheiro rotulo="Valor da hora de modelagem (R$/h)" valor={c.modelingRate} aoMudar={v => muda('modelingRate', v)} />
        </Secao>

        <Secao titulo="Insumos da peça" resumo={c.supplies.length
          ? `${c.supplies.map(x => `${x.qty}× ${x.name}`).join(', ')} · ${brl(custoInsumosPorPeca(c))} por peça`
          : 'argola, embalagem... nenhum escolhido'}>
          <div className="inv-largo">
            {c.supplies.map((x, i) => (
              <div className="pz-insumo" key={x.id}>
                <span><b>{x.name}</b><small>{brl(x.unitCost)} cada · {x.kind === 'embalagem' ? 'embalagem' : 'acabamento'}</small></span>
                <input type="number" inputMode="numeric" min={0} step="1" aria-label={'Quantidade de ' + x.name + ' por peça'} value={x.qty}
                  onChange={e => mudaInsumo(i, Math.max(0, Number(e.target.value) || 0))} />
                <span className="pz-insumo-total">{brl(x.qty * x.unitCost)}</span>
                <button aria-label={'Tirar ' + x.name} onClick={() => mudaInsumo(i, -1)}><Trash2 size={15} /></button>
              </div>
            ))}
            {(s.supplies || []).length ? (
              <label className="field"><span>Adicionar insumo (quantidade por peça)</span>
                <select className="select-trigger" value="" onChange={e => { if (e.target.value) adicionarInsumo(e.target.value); }}>
                  <option value="">Escolha o insumo</option>
                  {(s.supplies || []).map(x => <option key={x.id} value={x.id}>{x.name} — {brl(Number(x.unitCost) || 0)} por {x.unit}</option>)}
                </select>
              </label>
            ) : (
              <p className="pz-vazio">Nenhum insumo cadastrado. Cadastre em Materiais → Insumos.</p>
            )}
            <small className="pz-vazio">Multiplica pela quantidade de peças e fica fora da margem de falha.</small>
          </div>
        </Secao>

        <Secao titulo="Falha e pintura" resumo={`falha ${c.loss}%${c.paint ? ' · com pintura' : ''}`}>
          <Numero rotulo="Margem de falha (%)" valor={c.loss} aoMudar={v => muda('loss', v)} dica="Cobre material, energia, máquina, preparo e acabamento." />
          <label className="pz-check"><input type="checkbox" checked={c.paint} onChange={e => muda('paint', e.target.checked)} /> Tem pintura</label>
          {c.paint && <Dinheiro rotulo="Pintura (R$ por 100 g)" valor={c.paintRate} aoMudar={v => muda('paintRate', v)} />}
        </Secao>

        <Secao titulo="Venda: imposto, marketplace e anúncio" resumo={`imposto ${c.tax}% · marketplace ${c.marketplace}%`}>
          <Numero rotulo="Imposto (%)" valor={c.tax} aoMudar={v => muda('tax', v)} />
          <Numero rotulo="Marketplace (%)" valor={c.marketplace} aoMudar={v => muda('marketplace', v)} dica="Shopee, Mercado Livre. 0 se vende direto." />
          <Dinheiro rotulo="Taxa fixa por venda" valor={c.fixedFee} aoMudar={v => muda('fixedFee', v)} dica="Dividida entre as peças do pedido." />
          <Numero rotulo="ROAS médio" valor={c.roas} aoMudar={v => muda('roas', v)} passo="0.1" dica="0 se não anuncia." />
        </Secao>
      </div>

      <aside className="pz-resultado">
        <div className="pz-cartao">
          <span className="pz-rotulo-claro">Preço por peça</span>
          <p className="pz-preco">{r.blocked ? '—' : brl(r.unitPrice)}</p>
          {r.blocked && <p className="pz-alerta" role="alert">Imposto, marketplace e anúncio somam {Math.round(r.percFees * 100)}% do preço. Não sobra margem.</p>}
          <div className="pz-numeros">
            <div><span>Custo por peça</span><b>{brl(r.unitCost)}</b></div>
            <div><span>Lucro por peça</span><b className={r.unitProfit < 0 ? 'negative' : 'pz-lucro'}>{brl(r.unitProfit)}</b></div>
            <div><span>Lucro por hora</span><b>{horasTotais > 0 ? brl(r.profitPerHour) + '/h' : '—'}</b></div>
            {!r.blocked && <div><span>Preço mínimo</span><b>{brl(r.minPrice)}</b></div>}
          </div>
          {r.quantity > 1 && (
            <p className="pz-lote">Lote de {r.quantity} peças: <b>{brl(r.revenue)}</b> · lucro <b>{brl(r.profit)}</b></p>
          )}
          <details className="pz-composicao">
            <summary>Ver de onde vem o custo</summary>
            {r.rows.map(([n, v]) => <div key={n}><span>{n}</span><b>{brl(v)}</b></div>)}
            {r.discounts.map(([n, v]) => <div key={n}><span>{n}</span><b>-{brl(v)}</b></div>)}
          </details>
          <button className="btn full" onClick={adicionar} disabled={ocupado || r.blocked}><Plus size={17} /> Adicionar ao orçamento</button>
        </div>

        {!r.blocked && (
          <div className="pz-outro">
            <b>O cliente pediu outro preço?</b>
            <Campo rotulo="Preço por peça (R$)"><InputDinheiro valor={outroPreco} aoMudar={setOutroPreco} /></Campo>
            {analise && (
              <p className={oferta < r.minPrice ? 'pz-alerta' : 'pz-ok'} role={oferta < r.minPrice ? 'alert' : undefined}>
                {oferta < r.minPrice
                  ? `Abaixo do mínimo de ${brl(r.minPrice)}: prejuízo de ${brl(-analise.unitProfit)} por peça.`
                  : `Sobram ${brl(analise.unitProfit)} por peça (ROI ${Math.round(analise.roiReal)}%)${r.quantity > 1 ? `, ${brl(analise.profit)} no lote` : ''}.`}
              </p>
            )}
          </div>
        )}
      </aside>

      <div className="pz-orcamento panel">
        <div className="panel-heading"><h2>Orçamento em preparação</h2><span className="badge">{carrinho.length} peça(s)</span></div>
        {carrinho.map((it, i) => {
          const ri = calculate(it.calculation);
          return (
            <div className="pz-item" key={i}>
              <span><b>{it.calculation.quantity}× {it.name}</b>{it.arquivos.length > 0 && <small> · {it.arquivos.length} anexo(s)</small>}</span>
              <b>{brl(ri.revenue)}</b>
              <button aria-label={'Remover ' + it.name} onClick={() => setCarrinho(v => v.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
          );
        })}
        {!carrinho.length && <p className="pz-vazio">Calcule uma peça e toque em "Adicionar ao orçamento".</p>}
        <div className="pz-grade3">
          <Campo rotulo="Cliente">
            <select className="select-trigger" value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="">Selecione</option>
              {s.customers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Prazo de entrega"><input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} /></Campo>
          <Campo rotulo="Observações"><input value={obs} onChange={e => setObs(e.target.value)} /></Campo>
        </div>
        <div className="pz-rodape">
          <button className="text-btn" onClick={() => abrirCadastro('customers')}><Plus size={15} /> Cadastrar cliente</button>
          <b>Total: {brl(carrinho.reduce((a, it) => a + calculate(it.calculation).revenue, 0))}</b>
          <button className="btn" onClick={salvarOrcamento} disabled={ocupado}>Salvar orçamento</button>
        </div>
      </div>

      <div className="pz-barra" aria-hidden="true">
        <span>Preço por peça</span><b>{r.blocked ? '—' : brl(r.unitPrice)}</b>
      </div>
    </div>
  );
}
