'use client';
/*
 * Ferramentas (30/09/2026), aba de Materiais. Aprovado pelo dono:
 *  - Inventário das ferramentas e equipamentos (paquímetro, maçarico,
 *    alicate...): bens que a empresa usa e duram anos (imobilizado).
 *    Cada uma entra SOZINHA no total de Investimentos, na categoria
 *    "Ferramentas", sem ser lançada duas vezes.
 *  - Material de consumo (lâmina, lixa, cola, álcool): acaba com o uso, tem
 *    estoque e aviso de estoque baixo, mas não vai por peça, então não aparece
 *    na Precificação. Reaproveita a tela de Insumos (modo "consumo").
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import type { Entity, State } from '@/lib/domain';
import { InputDinheiro } from './campo-dinheiro';
import { Insumos } from './insumos';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dataBR = (v: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const CATEGORIAS = ['Medição', 'Corte', 'Acabamento', 'Aquecimento', 'Montagem', 'Limpeza', 'Equipamento', 'Outros'];
const FORMAS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência', 'Boleto'];
const SITUACOES = { 'em uso': 'Em uso', quebrada: 'Quebrada', perdida: 'Perdida', emprestada: 'Emprestada' } as const;
type Situacao = keyof typeof SITUACOES;

type Form = { id?: string; name: string; category: string; date: string; value: number; method: string; bank: string; status: Situacao; notes: string };
const vazio = (): Form => ({ name: '', category: '', date: hoje(), value: 0, method: 'Pix', bank: '', status: 'em uso', notes: '' });

export function Ferramentas({ s, ocupado, salvar }: { s: State; ocupado: boolean; salvar: (acao: unknown) => Promise<boolean> }) {
  const [form, setForm] = useState<Form | null>(null);
  const lista = [...(s.tools || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const total = lista.reduce((a, x) => a + (Number(x.value) || 0), 0);
  const emUso = lista.filter(x => x.status === 'em uso' || !x.status).length;
  const bancos = [...new Set([...(s.tools || []), ...(s.investments || [])].map(x => String(x.bank || '')).filter(Boolean))];
  const campo = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => f && ({ ...f, [k]: v }));

  async function gravar() {
    if (!form) return;
    if (!form.name.trim()) { toast.error('Dê um nome para a ferramenta.'); return; }
    const { id, ...dados } = form;
    if (await salvar({ type: 'tool', id, data: dados })) setForm(null);
  }

  async function apagar(x: Entity) {
    if (!window.confirm(`Apagar "${x.name}" do inventário? Ela também sai do total de Investimentos.`)) return;
    await salvar({ type: 'removeTool', id: x.id });
  }

  return (
    <div className="ferr">
      <div className="section-heading">
        <h2>Ferramentas e equipamentos</h2>
        <button className="btn" onClick={() => setForm(vazio())}><Plus size={17} /> Cadastrar ferramenta</button>
      </div>

      <div className="metrics">
        <div className="metric"><span>Valor em ferramentas</span><strong>{brl(total)}</strong><small>Entra no total de Investimentos</small></div>
        <div className="metric"><span>Itens no inventário</span><strong>{lista.length}</strong><small>{emUso} em uso</small></div>
      </div>

      {form && (
        <div className="panel">
          <div className="panel-heading"><h2>{form.id ? 'Editar ferramenta' : 'Nova ferramenta'}</h2></div>
          <div className="inv-campos">
            <label className="field"><span>Nome</span><input value={form.name} placeholder="Paquímetro digital" onChange={e => campo('name', e.target.value)} /></label>
            <label className="field"><span>Categoria</span>
              <input list="ferrCategorias" value={form.category} placeholder="Escolha ou digite" onChange={e => campo('category', e.target.value)} />
              <datalist id="ferrCategorias">{CATEGORIAS.map(c => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field"><span>Data da compra</span><input type="date" value={form.date} onChange={e => campo('date', e.target.value)} /></label>
            <label className="field"><span>Valor pago</span><InputDinheiro valor={form.value} aoMudar={v => campo('value', v)} /></label>
            <label className="field"><span>Forma de pagamento</span>
              <select className="select-trigger" value={form.method} onChange={e => campo('method', e.target.value)}>
                {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="field"><span>Banco ou conta</span>
              <input list="ferrBancos" value={form.bank} placeholder="Nubank, Inter, carteira..." onChange={e => campo('bank', e.target.value)} />
              <datalist id="ferrBancos">{bancos.map(b => <option key={b} value={b} />)}</datalist>
            </label>
            <label className="field"><span>Situação</span>
              <select className="select-trigger" value={form.status} onChange={e => campo('status', e.target.value as Situacao)}>
                {(Object.keys(SITUACOES) as Situacao[]).map(k => <option key={k} value={k}>{SITUACOES[k]}</option>)}
              </select>
            </label>
            <label className="field inv-largo"><span>Observações</span><input value={form.notes} placeholder="Onde fica, com quem está emprestada..." onChange={e => campo('notes', e.target.value)} /></label>
          </div>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn" disabled={ocupado} onClick={gravar}>Salvar</button>
          </div>
        </div>
      )}

      <div className="panel">
        {lista.length ? lista.map(x => {
          const st = (x.status || 'em uso') as Situacao;
          return (
            <div className="ferr-item" key={x.id}>
              <div className="material-icon"><Wrench size={20} /></div>
              <div>
                <b>{x.name}</b>
                <small>{[x.category, dataBR(x.date), x.method, x.bank].filter(Boolean).join(' · ')}</small>
                {x.notes && <small>{x.notes}</small>}
              </div>
              <span className={'inv-tag ' + (st === 'em uso' ? 'pago' : st === 'emprestada' ? 'pagando' : 'aberta ferr-alerta')}>{SITUACOES[st] || st}</span>
              <strong>{brl(Number(x.value) || 0)}</strong>
              <div className="inv-acoes">
                <button aria-label={'Editar ' + x.name} onClick={() => setForm({ id: x.id, name: x.name, category: x.category || '', date: x.date, value: Number(x.value) || 0, method: x.method || 'Pix', bank: x.bank || '', status: st, notes: x.notes || '' })}><Pencil size={16} /></button>
                <button aria-label={'Apagar ' + x.name} disabled={ocupado} onClick={() => apagar(x)}><Trash2 size={16} /></button>
              </div>
            </div>
          );
        }) : <p className="inv-nota">Nenhuma ferramenta cadastrada. Comece pelo que você mais usa: paquímetro, alicate, estilete, maçarico.</p>}
      </div>

      <Insumos s={s} ocupado={ocupado} salvar={salvar} modo="consumo" />
    </div>
  );
}
