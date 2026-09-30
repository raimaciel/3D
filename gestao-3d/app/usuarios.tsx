'use client';
/*
 * Usuários (30/09/2026): quem acessa o Gestão 3D. Só o administrador vê.
 * Criar, editar nome e papel, redefinir senha (gera senha temporária) e
 * desativar. As regras de segurança moram no servidor (app/api/usuarios);
 * esta tela só mostra e chama.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Pencil, Plus, ShieldCheck, UserX, UserCheck } from 'lucide-react';

type U = { id: string; email: string; name: string; role: string; created: string; ativo: boolean; trocarSenha: boolean; voce: boolean };
const PAPEL = { admin: 'Administrador', equipe: 'Equipe' } as Record<string, string>;

export function Usuarios() {
  const [lista, setLista] = useState<U[]>([]);
  const [chave, setChave] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<{ id?: string; nome: string; email: string; papel: string } | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch('/api/usuarios', { cache: 'no-store' });
      const d = await r.json() as { usuarios: U[]; chaveEmergencia: boolean; error?: string };
      if (!r.ok) throw new Error(d.error);
      setLista(d.usuarios); setChave(d.chaveEmergencia);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível carregar os usuários.'); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function acao(corpo: Record<string, unknown>) {
    setOcupado(true);
    try {
      const r = await fetch('/api/usuarios', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const d = await r.json() as { error?: string; senhaTemporaria?: string; email?: string };
      if (!r.ok) throw new Error(d.error);
      if (d.senhaTemporaria) setSenhaGerada({ email: d.email || '', senha: d.senhaTemporaria });
      await carregar();
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível concluir.'); return false; }
    finally { setOcupado(false); }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const ok = form.id
      ? await acao({ acao: 'editar', id: form.id, nome: form.nome, papel: form.papel })
      : await acao({ acao: 'criar', nome: form.nome, email: form.email, papel: form.papel });
    if (ok) { setForm(null); if (form.id) toast.success('Usuário atualizado'); }
  }

  function redefinir(u: U) {
    if (!window.confirm(`Redefinir a senha de ${u.name}? A senha atual para de funcionar e ${u.voce ? 'você vai precisar trocar a temporária' : 'a pessoa é desconectada de todos os aparelhos'}.`)) return;
    acao({ acao: 'redefinir', id: u.id });
  }

  function alternarAtivo(u: U) {
    if (u.ativo && !window.confirm(`Desativar o acesso de ${u.name}? A pessoa é desconectada na hora e não entra mais. O histórico fica guardado.`)) return;
    acao({ acao: 'ativar', id: u.id, ativo: !u.ativo }).then(ok => ok && toast.success(u.ativo ? 'Acesso desativado' : 'Acesso reativado'));
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); toast.success('Copiado'); }
    catch { toast.error('Não foi possível copiar. Anote à mão.'); }
  }

  return (
    <div className="usr">
      <div className="section-heading">
        <h2>Quem acessa o sistema</h2>
        <button className="btn" onClick={() => { setSenhaGerada(null); setForm({ nome: '', email: '', papel: 'equipe' }); }}><Plus size={17} /> Novo usuário</button>
      </div>

      {senhaGerada && (
        <div className="conta-codigo" role="alert">
          <p><b>Senha temporária de {senhaGerada.email}.</b> Passe para a pessoa (pessoalmente ou no WhatsApp dela). No primeiro acesso ela vai criar a própria senha. Esta senha não aparece de novo.</p>
          <code>{senhaGerada.senha}</code>
          <div className="row-actions">
            <button className="btn secondary small" onClick={() => copiar(`Acesso ao Gestão 3D\nEndereço: ${location.origin}\nE-mail: ${senhaGerada.email}\nSenha temporária: ${senhaGerada.senha}`)}><Copy size={15} /> Copiar com instruções</button>
            <button className="btn small" onClick={() => setSenhaGerada(null)}>Já passei</button>
          </div>
        </div>
      )}

      {form && (
        <form className="panel" onSubmit={salvar}>
          <div className="panel-heading"><h2>{form.id ? 'Editar usuário' : 'Novo usuário'}</h2></div>
          <div className="inv-campos">
            <label className="field"><span>Nome</span><input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
            <label className="field"><span>E-mail</span><input type="email" required disabled={!!form.id} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />{form.id && <small>O e-mail não muda. Para outro e-mail, crie um usuário novo.</small>}</label>
            <label className="field"><span>Papel</span>
              <select className="select-trigger" value={form.papel} onChange={e => setForm({ ...form, papel: e.target.value })}>
                <option value="equipe">Equipe: usa o sistema, não mexe em usuários</option>
                <option value="admin">Administrador: tudo, inclusive usuários</option>
              </select>
            </label>
          </div>
          {!form.id && <p className="inv-nota">O sistema gera uma senha temporária para você passar à pessoa.</p>}
          <div className="dialog-actions">
            <button type="button" className="btn secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn" type="submit" disabled={ocupado}>{form.id ? 'Salvar' : 'Criar e gerar senha'}</button>
          </div>
        </form>
      )}

      <div className="panel">
        {carregando ? <p className="inv-nota">Carregando…</p> : lista.map(u => (
          <div className="usr-item" key={u.id}>
            <div>
              <b>{u.name}{u.voce && <span className="inv-tag aberta"> você</span>}</b>
              <small>{u.email}</small>
              <span className="inv-tags">
                <span className={'inv-tag ' + (u.role === 'admin' ? 'pagando' : 'aberta')}>{PAPEL[u.role] || u.role}</span>
                {!u.ativo && <span className="venc-tag atrasada">Desativado</span>}
                {u.ativo && u.trocarSenha && <span className="venc-tag hoje">Ainda não trocou a senha temporária</span>}
              </span>
            </div>
            <div className="usr-acoes">
              <button className="btn secondary small" disabled={ocupado} onClick={() => { setSenhaGerada(null); setForm({ id: u.id, nome: u.name, email: u.email, papel: u.role }); }}><Pencil size={14} /> Editar</button>
              <button className="btn secondary small" disabled={ocupado || !u.ativo} onClick={() => redefinir(u)}><KeyRound size={14} /> Redefinir senha</button>
              {!u.voce && <button className="btn secondary small" disabled={ocupado} onClick={() => alternarAtivo(u)}>{u.ativo ? <><UserX size={14} /> Desativar</> : <><UserCheck size={14} /> Reativar</>}</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-heading"><ShieldCheck size={20} /><h2>Chave de emergência</h2>
          <span className={'inv-tag ' + (chave ? 'pago' : 'aberta')}>{chave ? 'Cadastrada' : 'Não cadastrada'}</span></div>
        <p className="conta-texto">
          É a última saída se o administrador perder a senha <b>e</b> o código de recuperação. Ela é cadastrada no painel da
          Cloudflare, então só quem entra na sua conta da Cloudflare consegue criá-la. <b>Não deixe cadastrada sem precisar:</b> crie
          só na hora do aperto e apague depois de usar.
        </p>
        <ol className="usr-passos">
          <li>Entre em <b>dash.cloudflare.com</b> com a sua conta.</li>
          <li>Abra <b>Workers &amp; Pages</b> → o projeto <b>3d</b> → <b>Settings</b> → <b>Variables and Secrets</b>.</li>
          <li>Clique em <b>Add</b>, escolha o tipo <b>Secret</b>, dê o nome <b>CHAVE_EMERGENCIA</b> e, no valor, uma sequência de pelo menos 16 letras e números que só você sabe. Salve.</li>
          <li>Na tela de entrada do sistema, toque em <b>Esqueci minha senha</b> e use essa sequência no lugar do código.</li>
          <li>Depois de entrar, volte ao painel e <b>apague</b> a CHAVE_EMERGENCIA.</li>
        </ol>
      </div>
    </div>
  );
}
