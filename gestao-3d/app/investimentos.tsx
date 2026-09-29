'use client';
/*
 * Investimentos (29/09/2026): o que foi posto na empresa (impressora,
 * ferramentas, material inicial...) e quanto disso já voltou.
 *
 * "Quanto já voltou" é o lucro dos pedidos, contado na proporção do que o
 * cliente já pagou (decisão do dono). As contas moram em lib/financeiro.ts.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { orderProfit, type Entity, type State } from '@/lib/domain';
import { lucroRecebido, retornoDoInvestimento } from '@/lib/financeiro';
import { InputDinheiro } from './campo-dinheiro';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dataBR = (v: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const CATEGORIAS = ['Impressora e equipamentos', 'Ferramentas', 'Filamento inicial', 'Peças e manutenção', 'Marketing', 'Móveis e estrutura', 'Outros'];
const FORMAS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência', 'Boleto'];

type Formulario = { id?: string; date: string; description: string; category: string; amount: number; method: string; bank: string; notes: string };
const vazio = (): Formulario => ({ date: hoje(), description: '', category: '', amount: 0, method: 'Pix', bank: '', notes: '' });

/** 0,49 -> "0,4%"; 37,8 -> "37%". Com pouco retorno, uma casa decimal, senão "0%" engana. */
const porcento = (v: number) => (v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v)).toLocaleString('pt-BR') + '%';


export function Investimentos({ s, ocupado, salvar }: {
  s: State;
  ocupado: boolean;
  salvar: (acao: unknown) => Promise<boolean>;
}) {
  const [form, setForm] = useState<Formulario | null>(null);
  const campo = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setForm(f => f && ({ ...f, [k]: v }));

  const lista = [...(s.investments || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const investido = lista.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const voltou = lucroRecebido(
    s.orders.map(o => ({ id: o.id, receita: o.revenue, lucro: orderProfit(o) })),
    s.payments.map(p => ({ orderId: String(p.orderId), amount: Number(p.amount) || 0 })),
  );
  const r = retornoDoInvestimento(investido, voltou);

  // Totais por categoria e por banco, do maior para o menor.
  const somaPor = (chave: 'category' | 'bank') => Object.entries(lista.reduce<Record<string, number>>((acc, x) => {
    const k = String(x[chave] || 'Sem banco informado');
    acc[k] = (acc[k] || 0) + (Number(x.amount) || 0); return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const bancosUsados = [...new Set(lista.map(x => String(x.bank || '')).filter(Boolean))];

  async function gravar() {
    if (!form) return;
    const valor = form.amount;
    if (!form.description.trim()) { toast.error('Descreva o investimento.'); return; }
    if (!form.category.trim()) { toast.error('Escolha ou digite a categoria.'); return; }
    if (!(valor > 0)) { toast.error('Informe um valor maior que zero.'); return; }
    const { id, ...dados } = form;
    if (await salvar({ type: 'investment', id, data: { ...dados, amount: valor } })) setForm(null);
  }

  async function apagar(x: Entity) {
    if (!window.confirm(`Apagar o investimento "${x.description}" de ${brl(Number(x.amount))}?`)) return;
    await salvar({ type: 'removeInvestment', id: x.id });
  }

  function editar(x: Entity) {
    setForm({ id: x.id, date: x.date, description: x.description, category: x.category,
      amount: Number(x.amount) || 0, method: x.method, bank: x.bank || '', notes: x.notes || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="inv">
      <div className="metrics">
        <div className="metric"><span>Total investido</span><strong>{brl(r.investido)}</strong></div>
        <div className="metric"><span>Já voltou</span><strong className={r.voltou < 0 ? 'negative' : 'positive'}>{brl(r.voltou)}</strong></div>
        <div className="metric"><span>Falta voltar</span><strong>{brl(r.falta)}</strong></div>
      </div>

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
            <label className="field"><span>Data</span><input type="date" value={form.date} onChange={e => campo('date', e.target.value)} /></label>
            <label className="field"><span>Descrição</span><input value={form.description} placeholder="Impressora Bambu Lab A1" onChange={e => campo('description', e.target.value)} /></label>
            <label className="field"><span>Categoria</span>
              <input list="invCategorias" value={form.category} placeholder="Escolha ou digite" onChange={e => campo('category', e.target.value)} />
              <datalist id="invCategorias">{CATEGORIAS.map(c => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field"><span>Valor</span><InputDinheiro valor={form.amount} aoMudar={v => campo('amount', v)} /></label>
            <label className="field"><span>Forma de pagamento</span>
              <select className="select-trigger" value={form.method} onChange={e => campo('method', e.target.value)}>
                {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="field"><span>Banco ou conta</span>
              <input list="invBancos" value={form.bank} placeholder="Nubank, Inter, carteira..." onChange={e => campo('bank', e.target.value)} />
              <datalist id="invBancos">{bancosUsados.map(b => <option key={b} value={b} />)}</datalist>
            </label>
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

      <div className="panel">
        {lista.length ? lista.map(x => (
          <div className="inv-item" key={x.id}>
            <div>
              <b>{x.description}</b>
              <small>{dataBR(x.date)} · {x.category} · {x.method}{x.bank ? ' · ' + x.bank : ''}</small>
              {x.notes && <small>{x.notes}</small>}
            </div>
            <strong>{brl(Number(x.amount))}</strong>
            <div className="inv-acoes">
              <button aria-label={'Editar ' + x.description} onClick={() => editar(x)}><Pencil size={16} /></button>
              <button aria-label={'Apagar ' + x.description} onClick={() => apagar(x)} disabled={ocupado}><Trash2 size={16} /></button>
            </div>
          </div>
        )) : <p className="inv-nota">Nenhum investimento cadastrado ainda. Comece pela impressora.</p>}
      </div>

      {lista.length > 0 && (
        <div className="inv-resumos">
          <div className="panel"><div className="panel-heading"><h2>Por categoria</h2></div>
            {somaPor('category').map(([k, v]) => <div className="inv-linha" key={k}><span>{k}</span><b>{brl(v)}</b></div>)}
          </div>
          <div className="panel"><div className="panel-heading"><h2>Por banco ou conta</h2></div>
            {somaPor('bank').map(([k, v]) => <div className="inv-linha" key={k}><span>{k}</span><b>{brl(v)}</b></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
