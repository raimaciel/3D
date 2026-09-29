'use client';
/*
 * Investimentos (29/09/2026): o que foi posto na empresa (impressora,
 * ferramentas, material inicial...) e quanto disso já voltou.
 *
 * "Quanto já voltou" é o lucro dos pedidos, contado na proporção do que o
 * cliente já pagou (decisão do dono). As contas moram em lib/financeiro.ts.
 *
 * Compra parcelada: o dono informa quantas parcelas e o vencimento da 1ª, e
 * marca cada parcela como paga À MÃO (decisão dele). Parcela vencida e não
 * marcada vira lembrete no topo da tela, para ele conferir se pagou aquela
 * fatura. As parcelas NÃO vão para Contas a pagar: a fatura do cartão já é
 * lançada lá, e contaria em dobro.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { BellRing, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { orderProfit, type Entity, type State } from '@/lib/domain';
import { lucroRecebido, resumoParcelas, retornoDoInvestimento, valoresDasParcelas, type ResumoParcelas } from '@/lib/financeiro';
import { InputDinheiro } from './campo-dinheiro';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dataBR = (v: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const CATEGORIAS = ['Impressora e equipamentos', 'Ferramentas', 'Filamento inicial', 'Peças e manutenção', 'Marketing', 'Móveis e estrutura', 'Outros'];
const FORMAS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência', 'Boleto'];

type Formulario = {
  id?: string; date: string; description: string; category: string; amount: number;
  method: string; bank: string; notes: string;
  parcelado: boolean; installments: number; firstDue: string;
};
const vazio = (): Formulario => ({ date: hoje(), description: '', category: '', amount: 0, method: 'Pix', bank: '', notes: '',
  parcelado: false, installments: 2, firstDue: '' });

/** 0,49 -> "0,4%"; 37,8 -> "37%". Com pouco retorno, uma casa decimal, senão "0%" engana. */
const porcento = (v: number) => (v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v)).toLocaleString('pt-BR') + '%';

/** Situação de pagamento de um investimento. À vista conta como pago. */
function situacao(x: Entity): ResumoParcelas {
  if (!x.parcelado) return resumoParcelas(Number(x.amount), 1, '', [1], hoje());
  return resumoParcelas(Number(x.amount), Number(x.installments), String(x.firstDue || ''), (x.paidParcels as number[]) || [], hoje());
}

export function Investimentos({ s, ocupado, salvar }: {
  s: State;
  ocupado: boolean;
  salvar: (acao: unknown) => Promise<boolean>;
}) {
  const [form, setForm] = useState<Formulario | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtroBanco, setFiltroBanco] = useState<string | null>(null);
  const campo = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setForm(f => f && ({ ...f, [k]: v }));

  const todos = [...(s.investments || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const nomeBanco = (x: Entity) => String(x.bank || 'Sem banco informado');
  const lista = filtroBanco ? todos.filter(x => nomeBanco(x) === filtroBanco) : todos;

  const investido = todos.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const aPagar = todos.reduce((a, x) => a + situacao(x).valorFalta, 0);
  const voltou = lucroRecebido(
    s.orders.map(o => ({ id: o.id, receita: o.revenue, lucro: orderProfit(o) })),
    s.payments.map(p => ({ orderId: String(p.orderId), amount: Number(p.amount) || 0 })),
  );
  const r = retornoDoInvestimento(investido, voltou);

  // Lembretes: parcelas que venceram e não foram marcadas como pagas.
  const lembretes = todos.flatMap(x => situacao(x).atrasadas.map(p => ({ inv: x, p })));

  // Totais por categoria e por banco, do maior para o menor.
  const somaPor = (chave: (x: Entity) => string) => Object.entries(todos.reduce<Record<string, { total: number; falta: number }>>((acc, x) => {
    const k = chave(x); acc[k] = acc[k] || { total: 0, falta: 0 };
    acc[k].total += Number(x.amount) || 0; acc[k].falta += situacao(x).valorFalta; return acc;
  }, {})).sort((a, b) => b[1].total - a[1].total);
  const bancosUsados = [...new Set(todos.map(x => String(x.bank || '')).filter(Boolean))];

  async function gravar() {
    if (!form) return;
    if (!form.description.trim()) { toast.error('Descreva o investimento.'); return; }
    if (!form.category.trim()) { toast.error('Escolha ou digite a categoria.'); return; }
    if (!(form.amount > 0)) { toast.error('Informe um valor maior que zero.'); return; }
    if (form.parcelado && !(form.installments >= 2)) { toast.error('Parcelado precisa de pelo menos 2 parcelas.'); return; }
    if (form.parcelado && !form.firstDue) { toast.error('Informe o vencimento da 1ª parcela.'); return; }
    const { id, ...dados } = form;
    if (await salvar({ type: 'investment', id, data: dados })) setForm(null);
  }

  async function marcarParcela(x: Entity, numero: number, paga: boolean) {
    await salvar({ type: 'investmentParcel', id: x.id, numero, paga });
  }

  async function apagar(x: Entity) {
    if (!window.confirm(`Apagar o investimento "${x.description}" de ${brl(Number(x.amount))}?`)) return;
    await salvar({ type: 'removeInvestment', id: x.id });
  }

  function editar(x: Entity) {
    setForm({ id: x.id, date: x.date, description: x.description, category: x.category, amount: Number(x.amount) || 0,
      method: x.method, bank: x.bank || '', notes: x.notes || '',
      parcelado: !!x.parcelado, installments: Number(x.installments) || 2, firstDue: x.firstDue || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const previa = form?.parcelado && form.installments >= 2 && form.amount > 0 ? valoresDasParcelas(form.amount, form.installments) : null;

  return (
    <div className="inv">
      <div className="metrics">
        <div className="metric"><span>Total investido</span><strong>{brl(r.investido)}</strong></div>
        <div className="metric"><span>Ainda a pagar (parcelas)</span><strong>{brl(aPagar)}</strong></div>
        <div className="metric"><span>Já voltou</span><strong className={r.voltou < 0 ? 'negative' : 'positive'}>{brl(r.voltou)}</strong></div>
        <div className="metric"><span>Falta voltar</span><strong>{brl(r.falta)}</strong></div>
      </div>

      {lembretes.length > 0 && (
        <div className="inv-lembretes" role="alert">
          <b><BellRing size={17} /> {lembretes.length === 1 ? 'Uma parcela venceu e não foi marcada como paga' : `${lembretes.length} parcelas venceram e não foram marcadas como pagas`}</b>
          <p>Confira se você pagou essas faturas. Se pagou, marque aqui.</p>
          {lembretes.map(({ inv, p }) => (
            <div className="inv-lembrete" key={inv.id + '-' + p.numero}>
              <span><b>{inv.description}</b> · parcela {p.numero} de {inv.installments} · {brl(p.valor)} · venceu em {dataBR(p.vencimento)} ({p.situacao.texto.toLowerCase()})</span>
              <button className="btn small" disabled={ocupado} onClick={() => marcarParcela(inv, p.numero, true)}>Já paguei</button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="inv-barra-topo">
          <b>{r.investido > 0 ? `${porcento(r.percentual)} do investimento já voltou` : 'Cadastre o que já foi investido para acompanhar o retorno'}</b>
        </div>
        <div className="inv-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, Math.max(0, r.percentual)))}>
          <span style={{ width: `${Math.min(100, Math.max(0, r.percentual))}%` }} />
        </div>
        <p className="inv-nota">"Já voltou" é o lucro dos pedidos, contado na proporção do que o cliente já pagou, e já descontadas as taxas de venda.</p>
      </div>

      {form ? (
        <div className="panel">
          <div className="panel-heading"><h2>{form.id ? 'Editar investimento' : 'Novo investimento'}</h2></div>
          <div className="inv-campos">
            <label className="field"><span>Data da compra</span><input type="date" value={form.date} onChange={e => campo('date', e.target.value)} /></label>
            <label className="field"><span>Descrição</span><input value={form.description} placeholder="Impressora Bambu Lab A1" onChange={e => campo('description', e.target.value)} /></label>
            <label className="field"><span>Categoria</span>
              <input list="invCategorias" value={form.category} placeholder="Escolha ou digite" onChange={e => campo('category', e.target.value)} />
              <datalist id="invCategorias">{CATEGORIAS.map(c => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field"><span>Valor total</span><InputDinheiro valor={form.amount} aoMudar={v => campo('amount', v)} /></label>
            <label className="field"><span>Forma de pagamento</span>
              <select className="select-trigger" value={form.method} onChange={e => campo('method', e.target.value)}>
                {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="field"><span>Banco ou conta</span>
              <input list="invBancos" value={form.bank} placeholder="Nubank, Inter, carteira..." onChange={e => campo('bank', e.target.value)} />
              <datalist id="invBancos">{bancosUsados.map(b => <option key={b} value={b} />)}</datalist>
            </label>
          </div>

          <p className="pz-rotulo">Pagamento</p>
          <div className="pz-chips">
            <button type="button" aria-pressed={!form.parcelado} onClick={() => campo('parcelado', false)}>À vista</button>
            <button type="button" aria-pressed={form.parcelado} onClick={() => campo('parcelado', true)}>Parcelado</button>
          </div>
          {form.parcelado && (
            <div className="inv-campos">
              <label className="field"><span>Quantidade de parcelas</span>
                <input type="number" inputMode="numeric" min={2} max={120} step="1" value={form.installments}
                  onChange={e => campo('installments', Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </label>
              <label className="field"><span>Vencimento da 1ª parcela</span><input type="date" value={form.firstDue} onChange={e => campo('firstDue', e.target.value)} /></label>
              {previa && <p className="pz-divisao inv-largo">{form.installments}x de {brl(previa[0])}{previa[previa.length - 1] !== previa[0] ? ` (a última de ${brl(previa[previa.length - 1])})` : ''}</p>}
            </div>
          )}
          <div className="inv-campos">
            <label className="field inv-largo"><span>Observações</span><input value={form.notes} onChange={e => campo('notes', e.target.value)} /></label>
          </div>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn" onClick={gravar} disabled={ocupado}>Salvar investimento</button>
          </div>
        </div>
      ) : (
        <div className="section-heading"><h2>Investimentos</h2><button className="btn" onClick={() => setForm(vazio())}><Plus size={16} /> Novo investimento</button></div>
      )}

      {filtroBanco && (
        <div className="inv-filtro">Mostrando só: <b>{filtroBanco}</b>
          <button aria-label="Mostrar todos os bancos" onClick={() => setFiltroBanco(null)}><X size={15} /> Mostrar todos</button>
        </div>
      )}

      <div className="panel">
        {lista.length ? lista.map(x => {
          const sit = situacao(x);
          const estaAberto = aberto === x.id;
          return (
            <div className={'inv-item' + (estaAberto ? ' aberto' : '')} key={x.id}>
              <button className="inv-cabeca" aria-expanded={estaAberto} onClick={() => setAberto(estaAberto ? null : x.id)}>
                <div>
                  <b>{x.description}</b>
                  <small>{dataBR(x.date)} · {x.category} · {x.method}{x.bank ? ' · ' + x.bank : ''}</small>
                  <span className="inv-tags">
                    {sit.quitado
                      ? <span className="inv-tag pago">{x.parcelado ? `Quitado · ${x.installments} parcelas pagas` : 'Pago à vista'}</span>
                      : <span className="inv-tag pagando">{sit.pagas} de {sit.total} parcelas pagas</span>}
                    {sit.atrasadas.length > 0 && <span className="venc-tag atrasada">{sit.atrasadas.length === 1 ? '1 parcela vencida sem marcar' : `${sit.atrasadas.length} parcelas vencidas sem marcar`}</span>}
                  </span>
                </div>
                <strong>{brl(Number(x.amount))}</strong>
                <ChevronDown size={18} className="inv-seta" aria-hidden="true" />
              </button>

              {estaAberto && (
                <div className="inv-detalhe">
                  <div className="inv-dados">
                    <div><span>Valor total</span><b>{brl(Number(x.amount))}</b></div>
                    <div><span>Pagamento</span><b>{x.parcelado ? `${x.installments}x de ${brl(sit.parcelas[0].valor)}` : 'À vista'}</b></div>
                    <div><span>Já pago</span><b className="positive">{brl(sit.valorPago)}</b></div>
                    <div><span>Falta pagar</span><b>{brl(sit.valorFalta)}</b></div>
                    <div><span>Forma e banco</span><b>{x.method}{x.bank ? ' · ' + x.bank : ''}</b></div>
                    <div><span>Próxima parcela</span><b>{sit.proxima ? `${sit.proxima.numero}ª em ${dataBR(sit.proxima.vencimento)}` : '—'}</b></div>
                  </div>
                  {x.notes && <p className="inv-nota">{x.notes}</p>}

                  {x.parcelado && (
                    <div className="inv-parcelas">
                      {sit.parcelas.map(p => (
                        <div className="inv-parcela" key={p.numero}>
                          <span>{p.numero}ª</span>
                          <span>{dataBR(p.vencimento)}</span>
                          <span>{brl(p.valor)}</span>
                          <span>
                            {p.paga ? <span className="inv-tag pago">Paga</span>
                              : p.situacao.texto ? <span className={'venc-tag ' + p.situacao.tom}>{p.situacao.texto}</span>
                                : <span className="inv-tag aberta">A pagar</span>}
                          </span>
                          <button className={p.paga ? 'text-btn' : 'btn small'} disabled={ocupado} onClick={() => marcarParcela(x, p.numero, !p.paga)}>
                            {p.paga ? 'Desmarcar' : 'Marcar como paga'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="inv-acoes">
                    <button className="btn secondary small" onClick={() => editar(x)}><Pencil size={15} /> Editar</button>
                    <button className="btn secondary small" onClick={() => apagar(x)} disabled={ocupado}><Trash2 size={15} /> Apagar</button>
                  </div>
                </div>
              )}
            </div>
          );
        }) : <p className="inv-nota">{filtroBanco ? 'Nenhum investimento neste banco.' : 'Nenhum investimento cadastrado ainda. Comece pela impressora.'}</p>}
      </div>

      {todos.length > 0 && (
        <div className="inv-resumos">
          <div className="panel"><div className="panel-heading"><h2>Por categoria</h2></div>
            {somaPor(x => String(x.category)).map(([k, v]) => <div className="inv-linha" key={k}><span>{k}</span><b>{brl(v.total)}</b></div>)}
          </div>
          <div className="panel"><div className="panel-heading"><h2>Por banco ou conta</h2></div>
            {somaPor(nomeBanco).map(([k, v]) => (
              <button className={'inv-linha inv-linha-botao' + (filtroBanco === k ? ' ativo' : '')} key={k} onClick={() => setFiltroBanco(filtroBanco === k ? null : k)}>
                <span>{k}{v.falta > 0 && <small>falta pagar {brl(v.falta)}</small>}</span><b>{brl(v.total)}</b>
              </button>
            ))}
            <p className="inv-nota">Toque num banco para ver só as compras dele.</p>
          </div>
        </div>
      )}
    </div>
  );
}
