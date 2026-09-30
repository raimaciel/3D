'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Box, LogIn, ShieldCheck } from 'lucide-react';
import Manager from './manager';

export type Usuario = { id: string; email: string; name: string; role: string; trocarSenha?: boolean };

/*
 * Portão do sistema. Enquanto não há sessão, nada da gestão é montado — e, mais
 * importante, a API recusa sozinha: esconder a tela não é a proteção, é só a
 * cortesia. A proteção está nas rotas.
 */
export default function Acesso() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [precisaConfigurar, setPrecisaConfigurar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState('');

  async function verificar() {
    setCarregando(true); setIndisponivel('');
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = await r.json() as { usuario: Usuario | null; precisaConfigurar: boolean };
      setUsuario(d.usuario); setPrecisaConfigurar(d.precisaConfigurar);
    } catch {
      setIndisponivel('Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.');
    } finally { setCarregando(false); }
  }
  useEffect(() => { verificar() }, []);

  if (carregando) return <div className="acesso-tela"><div className="acesso-card"><p className="acesso-carregando">Carregando…</p></div></div>;
  // Senha temporária (criada ou redefinida pelo admin): troca antes de tudo.
  if (usuario?.trocarSenha) return <div className="acesso-tela"><div className="acesso-card">
    <div className="acesso-marca"><div className="brand-mark"><Box size={26}/></div>
      <div><strong>GESTÃO<span>3D</span></strong><small>DA IDEIA À ENTREGA</small></div></div>
    <TrocarSenhaTemporaria nome={usuario.name} aoConcluir={verificar}/>
  </div></div>;
  if (usuario) return <Manager usuario={usuario} aoSair={() => { setUsuario(null); verificar() }} />;

  return <div className="acesso-tela"><div className="acesso-card">
    <div className="acesso-marca"><div className="brand-mark"><Box size={26}/></div>
      <div><strong>GESTÃO<span>3D</span></strong><small>DA IDEIA À ENTREGA</small></div></div>
    {indisponivel
      ? <><p className="acesso-erro" role="alert">{indisponivel}</p>
          <button className="btn full" onClick={verificar}>Tentar de novo</button></>
      : precisaConfigurar
        ? <Configurar aoEntrar={setUsuario}/>
        : <Entrar aoEntrar={setUsuario}/>}
  </div></div>;
}

function Entrar({ aoEntrar }: { aoEntrar: (u: Usuario) => void }) {
  const [email, setEmail] = useState(''), [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  if (esqueci) return <Recuperar aoEntrar={aoEntrar} aoVoltar={() => setEsqueci(false)} emailInicial={email}/>;

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) });
      const d = await r.json() as { usuario?: Usuario; error?: string };
      if (!r.ok || !d.usuario) { setErro(d.error || 'Não foi possível entrar.'); return }
      aoEntrar(d.usuario);
    } catch { setErro('Não foi possível entrar. Verifique sua conexão.') }
    finally { setEnviando(false) }
  }

  return <form onSubmit={enviar}>
    <h1 className="acesso-titulo">Entrar</h1>
    <p className="acesso-sub">Acesso restrito à equipe da Fabricando 3D.</p>
    {erro && <p className="acesso-erro" role="alert">{erro}</p>}
    <div className="acesso-campos">
      <label className="field"><span>E-mail</span>
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="field"><span>Senha</span>
        <input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)}/></label>
    </div>
    <button className="btn full" type="submit" disabled={enviando}>
      <LogIn size={18}/> {enviando ? 'Entrando…' : 'Entrar'}</button>
    <button type="button" className="text-btn acesso-link" onClick={() => setEsqueci(true)}>Esqueci minha senha</button>
  </form>;
}

/*
 * "Esqueci minha senha": com o código de recuperação que a pessoa gerou em
 * Configurações → Seu acesso. Não depende de e-mail (menos peças para manter).
 */
function Recuperar({ aoEntrar, aoVoltar, emailInicial }: { aoEntrar: (u: Usuario) => void; aoVoltar: () => void; emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial), [codigo, setCodigo] = useState('');
  const [nova, setNova] = useState(''), [repete, setRepete] = useState('');
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro('');
    if (nova !== repete) { setErro('As duas senhas novas não são iguais.'); return }
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/recuperar', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, codigo, nova }) });
      const d = await r.json() as { usuario?: Usuario; error?: string; usouChave?: boolean };
      if (!r.ok || !d.usuario) { setErro(d.error || 'Não foi possível recuperar o acesso.'); return }
      window.alert(d.usouChave
        ? 'Senha trocada com a CHAVE DE EMERGÊNCIA. Agora apague essa chave no painel da Cloudflare (Workers → 3d → Settings → Variables and Secrets) e gere um código de recuperação novo em Configurações → Seu acesso.'
        : 'Senha trocada. O código de recuperação que você usou não vale mais: gere um novo em Configurações → Seu acesso.');
      aoEntrar(d.usuario);
    } catch { setErro('Não foi possível recuperar o acesso. Verifique sua conexão.') }
    finally { setEnviando(false) }
  }

  return <form onSubmit={enviar}>
    <h1 className="acesso-titulo">Recuperar acesso</h1>
    <p className="acesso-sub">Use o <b>código de recuperação</b> que você gerou e guardou. Ele tem este formato: ABCD-EFGH-JKLM-NPQR.</p>
    {erro && <p className="acesso-erro" role="alert">{erro}</p>}
    <div className="acesso-campos">
      <label className="field"><span>E-mail</span>
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="field"><span>Código de recuperação</span>
        <input required autoComplete="off" autoCapitalize="characters" spellCheck={false} value={codigo} onChange={e => setCodigo(e.target.value)}/>
        <small>Administrador sem o código: use aqui a chave de emergência cadastrada no painel da Cloudflare.</small></label>
      <label className="field"><span>Senha nova</span>
        <input type="password" autoComplete="new-password" required value={nova} onChange={e => setNova(e.target.value)}/>
        <small>Pelo menos 10 caracteres, misturando letras e números.</small></label>
      <label className="field"><span>Repita a senha nova</span>
        <input type="password" autoComplete="new-password" required value={repete} onChange={e => setRepete(e.target.value)}/></label>
    </div>
    <button className="btn full" type="submit" disabled={enviando}>{enviando ? 'Trocando…' : 'Trocar senha e entrar'}</button>
    <button type="button" className="text-btn acesso-link" onClick={aoVoltar}>Voltar para o login</button>
    <p className="acesso-sub acesso-nota">Não tem o código? Então a senha só pode ser trocada direto no banco de dados, com ajuda técnica. Por isso é importante gerar o código e guardá-lo.</p>
  </form>;
}

/* Primeiro acesso com senha temporária: a pessoa escolhe a própria senha. */
function TrocarSenhaTemporaria({ nome, aoConcluir }: { nome: string; aoConcluir: () => void }) {
  const [atual, setAtual] = useState(''), [nova, setNova] = useState(''), [repete, setRepete] = useState('');
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro('');
    if (nova !== repete) { setErro('As duas senhas novas não são iguais.'); return }
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/senha', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atual, nova }) });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok) { setErro(d.error || 'Não foi possível trocar a senha.'); return }
      aoConcluir();
    } catch { setErro('Não foi possível trocar a senha. Verifique sua conexão.') }
    finally { setEnviando(false) }
  }

  return <form onSubmit={enviar}>
    <h1 className="acesso-titulo">Crie a sua senha</h1>
    <p className="acesso-sub">Olá, {nome}. Você entrou com uma <b>senha temporária</b>. Escolha agora a sua senha para continuar.</p>
    {erro && <p className="acesso-erro" role="alert">{erro}</p>}
    <div className="acesso-campos">
      <label className="field"><span>Senha temporária</span>
        <input type="password" autoComplete="current-password" required value={atual} onChange={e => setAtual(e.target.value)}/></label>
      <label className="field"><span>Sua senha nova</span>
        <input type="password" autoComplete="new-password" required value={nova} onChange={e => setNova(e.target.value)}/>
        <small>Pelo menos 10 caracteres, misturando letras e números.</small></label>
      <label className="field"><span>Repita a senha nova</span>
        <input type="password" autoComplete="new-password" required value={repete} onChange={e => setRepete(e.target.value)}/></label>
    </div>
    <button className="btn full" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar e entrar'}</button>
  </form>;
}

function Configurar({ aoEntrar }: { aoEntrar: (u: Usuario) => void }) {
  const [nome, setNome] = useState(''), [email, setEmail] = useState('');
  const [senha, setSenha] = useState(''), [token, setToken] = useState('');
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try {
      const r = await fetch('/api/auth/setup', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, senha, token }) });
      const d = await r.json() as { usuario?: Usuario; error?: string };
      if (!r.ok || !d.usuario) { setErro(d.error || 'Não foi possível criar o acesso.'); return }
      aoEntrar(d.usuario);
    } catch { setErro('Não foi possível criar o acesso. Verifique sua conexão.') }
    finally { setEnviando(false) }
  }

  return <form onSubmit={enviar}>
    <h1 className="acesso-titulo">Criar o primeiro acesso</h1>
    <p className="acesso-sub">Ninguém foi cadastrado ainda. Esta tela funciona <b>uma única vez</b>: depois dela, o sistema só abre com login.</p>
    <p className="acesso-aviso"><ShieldCheck size={17}/><span>Se o sistema já está publicado na internet, faça isto <b>agora</b>. Até você criar este acesso, quem abrir o endereço pode criá-lo no seu lugar.</span></p>
    {erro && <p className="acesso-erro" role="alert">{erro}</p>}
    <div className="acesso-campos">
      <label className="field"><span>Seu nome</span>
        <input required value={nome} onChange={e => setNome(e.target.value)}/></label>
      <label className="field"><span>E-mail</span>
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="field"><span>Senha</span>
        <input type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)}/>
        <small>Pelo menos 10 caracteres, misturando letras e números.</small></label>
      <label className="field"><span>Código de configuração</span>
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Só se você configurou SETUP_TOKEN"/>
        <small>Deixe em branco se não configurou essa variável no provedor.</small></label>
    </div>
    <button className="btn full" type="submit" disabled={enviando}>
      {enviando ? 'Criando…' : 'Criar acesso e entrar'}</button>
  </form>;
}
