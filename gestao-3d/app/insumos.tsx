'use client';
/*
 * Insumos (29/09/2026): argola de chaveiro, saquinho, caixa, etiqueta, ímã...
 * Contados em UNIDADES, com estoque próprio. O filamento continua em gramas,
 * nas bobinas de Materiais.
 *
 * Na Precificação, escolhe-se quais insumos cada peça leva; o custo entra
 * sozinho e fica fora da margem de falha. Quando o pedido é marcado como
 * embalado na Produção, os insumos saem do estoque.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { supplyStock, type Entity, type State } from '@/lib/domain';
import { InputDinheiro } from './campo-dinheiro';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dataBR = (v: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const UNIDADES = ['unidade', 'pacote', 'par', 'metro', 'rolo'];
export const TIPOS_INSUMO = { acabamento: 'Acabamento', embalagem: 'Embalagem' } as const;

type Cadastro = { id?: string; name: string; kind: 'acabamento' | 'embalagem'; unit: string; unitCost: number; minimum: number; initialQty: number; notes: string };
type Movimento = { supplyId: string; sentido: 'entrada' | 'saida'; qty: number; date: string; reason: string };

export function Insumos({ s, ocupado, salvar }: { s: State; ocupado: boolean; salvar: (acao: unknown) => Promise<boolean> }) {
  const [cad, setCad] = useState<Cadastro | null>(null);
  const [mov, setMov] = useState<Movimento | null>(null);
  const insumos = [...(s.supplies || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const nomeDo = (id: string) => insumos.find(x => x.id === id)?.name || 'Insumo apagado';
  const recentes = [...(s.supplyMovements || [])].reverse().slice(0, 12);

  async function gravarCadastro() {
    if (!cad) return;
    if (!cad.name.trim()) { toast.error('Dê um nome para o insumo.'); return; }
    const { id, ...dados } = cad;
    if (await salvar({ type: 'supply', id, data: dados })) setCad(null);
  }

  async function gravarMovimento() {
    if (!mov) return;
    if (!mov.supplyId) { toast.error('Escolha o insumo.'); return; }
    if (!(mov.qty > 0)) { toast.error('Informe a quantidade.'); return; }
    if (!mov.reason.trim()) { toast.error('Diga o motivo (compra, perda, ajuste...).'); return; }
    const qty = mov.sentido === 'entrada' ? mov.qty : -mov.qty;
    if (await salvar({ type: 'supplyMovement', data: { supplyId: mov.supplyId, qty, date: mov.date, reason: mov.reason } })) setMov(null);
  }

  async function apagar(x: Entity) {
    if (!window.confirm(`Apagar o insumo "${x.name}"? Orçamentos já feitos não mudam.`)) return;
    await salvar({ type: 'removeSupply', id: x.id });
  }

  return (
    <div className="ins">
      <div className="section-heading">
        <h2>Insumos</h2>
        <div className="row-actions">
          <button className="btn secondary" disabled={!insumos.length}
            onClick={() => { setCad(null); setMov({ supplyId: insumos[0]?.id || '', sentido: 'entrada', qty: 0, date: hoje(), reason: 'Compra' }); }}>
            Entrada ou ajuste
          </button>
          <button className="btn" onClick={() => { setMov(null); setCad({ name: '', kind: 'acabamento', unit: 'unidade', unitCost: 0, minimum: 0, initialQty: 0, notes: '' }); }}>
            <Plus size={17} /> Cadastrar insumo
          </button>
        </div>
      </div>

      {cad && (
        <div className="panel">
          <div className="panel-heading"><h2>{cad.id ? 'Editar insumo' : 'Novo insumo'}</h2></div>
          <p className="pz-rotulo">Tipo</p>
          <div className="pz-chips">
            {(Object.keys(TIPOS_INSUMO) as (keyof typeof TIPOS_INSUMO)[]).map(k => (
              <button key={k} type="button" aria-pressed={cad.kind === k} onClick={() => setCad({ ...cad, kind: k })}>{TIPOS_INSUMO[k]}</button>
            ))}
          </div>
          <div className="inv-campos">
            <label className="field"><span>Nome</span><input value={cad.name} placeholder="Argola de chaveiro" onChange={e => setCad({ ...cad, name: e.target.value })} /></label>
            <label className="field"><span>Unidade</span>
              <select className="select-trigger" value={cad.unit} onChange={e => setCad({ ...cad, unit: e.target.value })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="field"><span>Custo por {cad.unit}</span><InputDinheiro valor={cad.unitCost} aoMudar={v => setCad({ ...cad, unitCost: v })} /></label>
            <label className="field"><span>Estoque mínimo</span>
              <input type="number" inputMode="numeric" min={0} step="1" value={cad.minimum} onChange={e => setCad({ ...cad, minimum: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            {!cad.id && (
              <label className="field"><span>Quantidade que você tem agora</span>
                <input type="number" inputMode="numeric" min={0} step="1" value={cad.initialQty} onChange={e => setCad({ ...cad, initialQty: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
            )}
            <label className="field inv-largo"><span>Observações</span><input value={cad.notes} onChange={e => setCad({ ...cad, notes: e.target.value })} /></label>
          </div>
          {cad.id && <p className="inv-nota">Para mudar a quantidade em estoque, use "Entrada ou ajuste".</p>}
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setCad(null)}>Cancelar</button>
            <button className="btn" disabled={ocupado} onClick={gravarCadastro}>Salvar insumo</button>
          </div>
        </div>
      )}

      {mov && (
        <div className="panel">
          <div className="panel-heading"><h2>Entrada ou ajuste de estoque</h2></div>
          <div className="pz-chips">
            <button type="button" aria-pressed={mov.sentido === 'entrada'} onClick={() => setMov({ ...mov, sentido: 'entrada', reason: 'Compra' })}>Entrada</button>
            <button type="button" aria-pressed={mov.sentido === 'saida'} onClick={() => setMov({ ...mov, sentido: 'saida', reason: 'Perda' })}>Saída (perda ou ajuste)</button>
          </div>
          <div className="inv-campos">
            <label className="field"><span>Insumo</span>
              <select className="select-trigger" value={mov.supplyId} onChange={e => setMov({ ...mov, supplyId: e.target.value })}>
                {insumos.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Quantidade</span>
              <input type="number" inputMode="numeric" min={0} step="1" value={mov.qty} onChange={e => setMov({ ...mov, qty: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="field"><span>Data</span><input type="date" value={mov.date} onChange={e => setMov({ ...mov, date: e.target.value })} /></label>
            <label className="field"><span>Motivo</span><input value={mov.reason} onChange={e => setMov({ ...mov, reason: e.target.value })} /></label>
          </div>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setMov(null)}>Cancelar</button>
            <button className="btn" disabled={ocupado} onClick={gravarMovimento}>Registrar</button>
          </div>
        </div>
      )}

      {insumos.length ? (
        <div className="material-grid">
          {insumos.map(x => {
            const tem = supplyStock(s, x.id), baixo = tem <= Number(x.minimum || 0);
            return (
              <div className="material-card" key={x.id}>
                <div className="flex justify-between">
                  <div className="material-icon"><Package size={26} /></div>
                  <span className={'badge ' + (baixo ? 'orange' : 'green')}>{baixo ? 'Estoque baixo' : 'Disponível'}</span>
                </div>
                <h2>{x.name}</h2>
                <p>{TIPOS_INSUMO[x.kind as keyof typeof TIPOS_INSUMO] || x.kind} · {brl(Number(x.unitCost))} por {x.unit}</p>
                <strong>{qtd(tem)} <span>{x.unit}{Math.abs(tem) === 1 ? '' : 's'}</span></strong>
                <div className="material-bottom">
                  <span>Mínimo: {qtd(Number(x.minimum || 0))}</span>
                  <span className="inv-acoes">
                    <button aria-label={'Editar ' + x.name} onClick={() => { setMov(null); setCad({ id: x.id, name: x.name, kind: x.kind, unit: x.unit, unitCost: Number(x.unitCost) || 0, minimum: Number(x.minimum) || 0, initialQty: 0, notes: x.notes || '' }); }}><Pencil size={16} /></button>
                    <button aria-label={'Apagar ' + x.name} disabled={ocupado} onClick={() => apagar(x)}><Trash2 size={16} /></button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel"><p className="inv-nota">Nenhum insumo cadastrado. Comece pela argola de chaveiro e pela embalagem que você usa.</p></div>
      )}

      {recentes.length > 0 && (
        <div className="panel ins-historico">
          <div className="panel-heading"><h2>Últimas movimentações</h2></div>
          {recentes.map(m => (
            <div className="inv-linha" key={m.id}>
              <span>{dataBR(m.date)} · {nomeDo(m.supplyId)} · {m.reason}</span>
              <b className={Number(m.qty) < 0 ? 'negative' : 'positive'}>{Number(m.qty) > 0 ? '+' : ''}{qtd(Number(m.qty))}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
