# Publicar o Gestão 3D

Guia para colocar o sistema no ar na Cloudflare, no domínio `fabricando3d.com.br`.

Leia até o fim antes de começar. São uns 30 a 60 minutos na primeira vez.

---

## Antes de qualquer coisa: uma coisa que trava gente no meio

**A Cloudflare exige um cartão cadastrado para habilitar o R2**, que é onde os STL, 3MF e fotos vão ficar. Mesmo no plano grátis. Não cobra nada enquanto você estiver dentro do limite (10 GB, com download ilimitado e gratuito), mas sem cartão o botão de ativar nem funciona.

Se você não quiser cadastrar cartão agora, dá para publicar **sem** o R2: o sistema sobe, o login funciona, os orçamentos funcionam, e só o envio de arquivo e foto fica indisponível. Me avise que eu ajusto.

---

## Parte 1 — Na Cloudflare, pelo navegador

1. **Crie a conta** em `dash.cloudflare.com` (grátis).
2. **Cadastre um cartão** em Billing / Faturamento.
3. **Ative o R2** no menu lateral, em R2 Object Storage.
4. **Crie o bucket** do R2 com o nome `fabricando3d-arquivos`.
5. **Crie o banco D1** no menu Storage & Databases → D1, com o nome `fabricando3d`.
   Quando ele abrir, **anote o Database ID** — é um código com traços, parecido com
   `a1b2c3d4-0000-4444-8888-99887766aabb`. Você vai precisar dele.

---

## Parte 2 — Criar as tabelas do banco

O banco nasce vazio. Precisa criar as tabelas **uma única vez**.

Pelo painel: abra o banco `fabricando3d`, vá na aba de **Console** (ou "Query"), e cole o conteúdo de cada arquivo abaixo, **um de cada vez, nesta ordem**, executando cada um:

1. `drizzle/0000_small_solo.sql` — a tabela dos dados do sistema
2. `drizzle/0001_login.sql` — as tabelas de login, sessão e trava de senha

Os dois arquivos estão neste repositório, na pasta `drizzle/`.

Para conferir que deu certo, rode no console: `SELECT name FROM sqlite_master WHERE type='table';`
Devem aparecer: `workspace`, `users`, `sessions`, `login_attempts`.

---

## Parte 3 — Publicar o sistema

Há dois caminhos. **Escolha um.**

### Caminho A — Sem terminal, pelo painel (recomendado se você nunca usou terminal)

A Cloudflare consegue publicar direto do GitHub, sem você instalar nada no computador.

No painel, em Workers & Pages, crie um Worker conectado a este repositório
(`raimaciel/3D`), apontando para a pasta `gestao-3d`, e configure:

- **Comando de instalação:** `pnpm install --frozen-lockfile`
- **Comando de build:** `pnpm build`
- **Comando de deploy:** `npx wrangler deploy --config dist/server/wrangler.json`
- **Variáveis de ambiente do build:**
  `CF_WORKER_NAME=fabricando3d`, `CF_D1_NOME=fabricando3d`,
  `CF_D1_ID=<o id que você anotou>`, `CF_R2_BUCKET=fabricando3d-arquivos`

Depois, nas configurações do Worker, ligue os **bindings**: `DB` para o banco
`fabricando3d` e `BUCKET` para o bucket `fabricando3d-arquivos`.

> As telas da Cloudflare mudam de tempos em tempos. Se algum nome estiver
> diferente do que está escrito aqui, me mande um print que eu te digo onde
> clicar.

### Caminho B — Pelo terminal

Precisa de **Node.js 22 ou superior** e **pnpm 11** instalados.

```bash
git clone https://github.com/raimaciel/3D.git
cd 3D/gestao-3d
pnpm install --frozen-lockfile

cp .env.exemplo .env
# abra o .env e preencha o CF_D1_ID com o id que você anotou

npx wrangler login          # abre o navegador para autorizar

bash scripts/publicar.sh --simular   # confere tudo sem publicar
bash scripts/publicar.sh             # publica de verdade
```

O script roda os testes, compila, cria as tabelas e publica. Se faltar algo, ele
para e diz exatamente o que fazer.

---

## Parte 4 — O PRIMEIRO ACESSO, e por que é urgente

Assim que publicar, o sistema fica com **uma janela aberta**: enquanto ninguém
tiver criado a primeira conta, **quem abrir o endereço pode criá-la no seu lugar**
e virar o administrador.

Então, ao terminar de publicar:

1. Abra o endereço na mesma hora.
2. Crie o seu acesso na tela "Criar o primeiro acesso".

Depois disso essa tela fecha para sempre e o sistema só abre com login.

**Se você preferir fechar a janela antes**, dá para exigir um código secreto na
criação do primeiro acesso:

```bash
npx wrangler secret put SETUP_TOKEN
```

Ele pede um valor; invente uma frase e guarde. Aí a tela de primeiro acesso passa
a exigir esse código, e ninguém cria a conta sem ele. No Caminho A, o mesmo se faz
no painel, em Settings → Variables → adicionar um **Secret** chamado `SETUP_TOKEN`.

---

## Parte 5 — Apontar o fabricando3d.com.br

Com o sistema no ar, ele responde num endereço temporário terminado em
`.workers.dev`. Para usar o seu domínio:

1. Adicione `fabricando3d.com.br` à sua conta Cloudflare (menu de domínios).
2. A Cloudflare vai te dar dois servidores de DNS. Troque-os no site onde você
   registrou o domínio.
3. Depois que o domínio ficar ativo, volte no Worker e adicione um
   **Custom Domain** com `fabricando3d.com.br`.

A troca de DNS pode levar de minutos a algumas horas para valer em todo lugar.

---

## Depois de publicado

- **Backup**: o sistema exporta os dados em Configurações → Backup. Faça isso de
  vez em quando e guarde o arquivo fora da Cloudflare.
- **Conferir que está fechado**: com o sistema no ar, rode
  `bash scripts/teste-acesso.sh https://seu-endereco` — deve dar `9 passaram, 0 falharam`.
- **Custo**: dentro dos limites grátis, zero. Se o uso crescer, a Cloudflare avisa.
