'use client';
/*
 * "Seu acesso" (30/09/2026): trocar a senha e gerar o código de recuperação.
 * Fica no item "Meu acesso" do menu, que todo mundo vê (o funcionário
 * normalmente não tem Configurações). O lembrete da Visão geral também mora aqui.
 *
 * O código de recuperação é a saída para quem esquece a senha, sem depender
 * de e-mail. Ele aparece UMA VEZ: o banco guarda só o hash.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, ShieldAlert } from 'lucide-react';

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

async function statusCodigo(): Promise<{ temCodigo: boolean; criadoEm: string | null } | null> {
  try {
    const r = await fetch('/api/auth/codigo', { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Aviso na Visão geral enquanto a pessoa não gerou o código. */
export function LembreteCodigo({ irPara }: { irPara: (pagina: string) => void }) {
  const [falta, setFalta] = useState(false);
  useEffect(() => { statusCodigo().then(s => setFalta(!!s && !s.temCodigo)); }, []);
  if (!falta) return null;
  return (
    <div className="conta-lembrete" role="status">
      <ShieldAlert size={18} />
      <span><b>Gere seu código de recuperação.</b> Sem ele, se você esquecer a senha, não há como entrar de novo.</span>
      <button className="btn small" onClick={() => irPara('Meu acesso')}>Gerar agora</button>
    </div>
  );
}

/*
 * Meu perfil: a pessoa pede para mudar nome, telefone e e-mail. Não vale na
 * hora: vira um pedido que o administrador aprova em Usuários.
 */
type Perfil = { nome: string; email: string; telefone: string; pedido: { name: string; phone: string; email: string; created: string } | null };

function MeuPerfil() {
  const [p, setP] = useState<Perfil | null>(null);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '' });
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    try {
      const r = await fetch('/api/perfil', { cache: 'no-store' });
      const d = await r.json() as Perfil;
      if (r.ok) { setP(d); setForm({ nome: d.nome, telefone: d.telefone, email: d.email }); }
    } catch { /* o painel mostra só o resto */ }
  }
  useEffect(() => { carregar(); }, []);

  async function enviar(e: FormEvent, corpo: Record<string, unknown>, ok: string) {
    e.preventDefault(); setOcupado(true);
    try {
      const r = await fetch('/api/perfil', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Não foi possível enviar.');
      toast.success(ok); await carregar();
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setOcupado(false); }
  }

  if (!p) return null;
  return (
    <div className="conta-bloco conta-primeiro">
      <b>Meu perfil</b>
      <p className="conta-texto">Mudanças aqui viram um <b>pedido</b>: só valem depois que o administrador aprovar.</p>
      {p.pedido && (
        <div className="conta-pedido">
          <span><b>Pedido esperando aprovação</b> (enviado em {dataBR(p.pedido.created)}): {p.pedido.name} · {p.pedido.phone || 'sem telefone'} · {p.pedido.email}</span>
          <button className="text-btn" disabled={ocupado} onClick={e => enviar(e, { cancelar: true }, 'Pedido cancelado')}>Cancelar pedido</button>
        </div>
      )}
      <form className="conta-campos" onSubmit={e => enviar(e, form, 'Pedido enviado ao administrador')}>
        <label className="field"><span>Nome</span><input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label className="field"><span>Telefone / WhatsApp</span><input inputMode="tel" placeholder="(85) 99999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></label>
        <label className="field"><span>E-mail (é o seu login)</span><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <button className="btn secondary" type="submit" disabled={ocupado}>Pedir mudança</button>
      </form>
    </div>
  );
}

export function SeuAcesso() {
  const [status, setStatus] = useState<{ temCodigo: boolean; criadoEm: string | null } | null>(null);
  const [codigoNovo, setCodigoNovo] = useState('');
  const [senhaCodigo, setSenhaCodigo] = useState('');
  const [atual, setAtual] = useState(''), [nova, setNova] = useState(''), [repete, setRepete] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { statusCodigo().then(setStatus); }, []);

  async function post(url: string, corpo: unknown) {
    const r = await fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({})) as { error?: string; codigo?: string; criadoEm?: string };
    if (!r.ok) throw new Error(d.error || 'Não foi possível concluir.');
    return d;
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault();
    if (nova !== repete) { toast.error('As duas senhas novas não são iguais.'); return; }
    setOcupado(true);
    try {
      await post('/api/auth/senha', { atual, nova });
      setAtual(''); setNova(''); setRepete('');
      toast.success('Senha trocada. Outros aparelhos conectados na sua conta foram desconectados.');
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setOcupado(false); }
  }

  async function gerarCodigo(e: FormEvent) {
    e.preventDefault();
    if (status?.temCodigo && !window.confirm('Gerar um código novo faz o anterior parar de funcionar. Continuar?')) return;
    setOcupado(true);
    try {
      const d = await post('/api/auth/codigo', { senha: senhaCodigo });
      setCodigoNovo(d.codigo || ''); setSenhaCodigo('');
      setStatus({ temCodigo: true, criadoEm: d.criadoEm || null });
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setOcupado(false); }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(codigoNovo); toast.success('Código copiado'); }
    catch { toast.error('Não foi possível copiar. Anote o código à mão.'); }
  }

  return (
    <div className="panel conta">
      <div className="panel-heading"><KeyRound size={20} /><h2>Seu acesso</h2></div>

      <MeuPerfil />

      <form onSubmit={trocarSenha} className="conta-bloco">
        <b>Trocar senha</b>
        <div className="conta-campos">
          <label className="field"><span>Senha atual</span><input type="password" autoComplete="current-password" required value={atual} onChange={e => setAtual(e.target.value)} /></label>
          <label className="field"><span>Senha nova</span><input type="password" autoComplete="new-password" required value={nova} onChange={e => setNova(e.target.value)} /><small>Pelo menos 10 caracteres, misturando letras e números.</small></label>
          <label className="field"><span>Repita a senha nova</span><input type="password" autoComplete="new-password" required value={repete} onChange={e => setRepete(e.target.value)} /></label>
        </div>
        <button className="btn" type="submit" disabled={ocupado}>Trocar senha</button>
      </form>

      <div className="conta-bloco">
        <b>Código de recuperação</b>
        <p className="conta-texto">
          Se você esquecer a senha, é com este código que você entra de novo, pela opção "Esqueci minha senha" na tela de entrada.
          {status && (status.temCodigo
            ? <> Seu código atual foi gerado em <b>{status.criadoEm ? dataBR(status.criadoEm) : '—'}</b>.</>
            : <> <b className="negative">Você ainda não gerou o seu.</b></>)}
        </p>

        {codigoNovo ? (
          <div className="conta-codigo" role="alert">
            <p><b>Guarde este código agora.</b> Ele não vai aparecer de novo. Anote num papel guardado em lugar seguro ou salve no gerenciador de senhas do celular.</p>
            <code>{codigoNovo}</code>
            <div className="row-actions">
              <button className="btn secondary small" onClick={copiar}><Copy size={15} /> Copiar</button>
              <button className="btn small" onClick={() => setCodigoNovo('')}>Já guardei</button>
            </div>
          </div>
        ) : (
          <form onSubmit={gerarCodigo} className="conta-campos">
            <label className="field"><span>Sua senha, para confirmar</span><input type="password" autoComplete="current-password" required value={senhaCodigo} onChange={e => setSenhaCodigo(e.target.value)} /></label>
            <button className="btn secondary" type="submit" disabled={ocupado}>{status?.temCodigo ? 'Gerar código novo' : 'Gerar código'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
