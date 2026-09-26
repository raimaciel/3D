# Passo a passo: publicar pelo painel da Cloudflare

Detalhado, clique a clique. Você já fez o banco e o bucket; isto é o resto.

> **As telas da Cloudflare mudam.** Os nomes dos botões aqui podem estar
> ligeiramente diferentes do que você vê. Quando não bater, **mande um print** em
> vez de adivinhar.

---

## A — Começar a criação do Worker

**A1.** Entre em `dash.cloudflare.com`.

**A2.** No menu da esquerda, procure **Compute (Workers)** ou **Workers & Pages**.
Clique.

**A3.** Clique no botão azul **Create** (ou "Create application" / "Criar").

**A4.** Vão aparecer opções de como começar. Procure a que fala em **importar um
repositório** — costuma se chamar **Import a repository**, **Connect to Git** ou
**Deploy from GitHub**. **Não** escolha "Start with Hello World" nem os modelos.

---

## B — Dar acesso ao seu GitHub

Só na primeira vez.

**B1.** Clique em **Connect GitHub** / **Sign in with GitHub**. Abre uma janela do
GitHub.

**B2.** O GitHub vai pedir para instalar o aplicativo da Cloudflare. Escolha a
conta **raimaciel**.

**B3.** Em "Repository access", escolha **Only select repositories** e marque o
repositório **`3D`**. Não precisa dar acesso a todos.

**B4.** Confirme em **Install & Authorize**. Volta para a Cloudflare.

**B5.** Na lista de repositórios, selecione **`raimaciel/3D`** e continue.

---

## C — Configurar a construção

Esta é a parte que importa. Preencha **exatamente** assim:

| Campo | O que colocar |
|---|---|
| Project name / Nome | `fabricando3d` |
| Production branch | `main` |
| **Root directory** | `gestao-3d` |
| Build command | `pnpm build` |
| Deploy command | `npx wrangler deploy --config dist/server/wrangler.json` |

**Atenção ao Root directory.** O repositório tem a calculadora na raiz e o sistema
dentro da pasta `gestao-3d`. Se esse campo ficar vazio, a construção procura o
projeto no lugar errado e falha dizendo que não achou o `package.json`.

Se houver um campo de **Install command**, coloque:
`pnpm install --frozen-lockfile`
Se não houver, tudo bem — a Cloudflare instala sozinha.

**Não preencha variável de ambiente nenhuma.** O banco, o bucket e o nome já estão
gravados no projeto.

---

## D — Publicar

**D1.** Clique em **Save and Deploy** (ou "Create and Deploy").

**D2.** Vai abrir uma tela de registro da construção, com o texto rolando. Leva de
2 a 5 minutos na primeira vez.

**D3.** No fim, procure a linha com o endereço, algo como:

```
https://fabricando3d.<alguma-coisa>.workers.dev
```

**Copie esse endereço.**

---

## E — AGORA, sem esperar: criar seu acesso

**E1.** Abra o endereço no navegador imediatamente.

**E2.** Vai aparecer a tela **"Criar o primeiro acesso"**. Preencha seu nome,
e-mail e uma senha de pelo menos 10 caracteres, misturando letras e números.
Deixe o campo do código de configuração **em branco**.

**E3.** Clique em **Criar acesso e entrar**.

**Por que a pressa:** enquanto ninguém criou essa primeira conta, quem abrir o
endereço pode criá-la no seu lugar e virar o administrador do sistema. Depois que
você criar, essa tela fecha para sempre.

**E4.** Confirme que entrou: deve aparecer a tela **Visão geral**, com seu nome no
canto superior direito e o botão **Sair** ao lado.

---

## F — Conferir que ficou tudo certo

**F1.** Nas configurações do Worker, procure **Settings → Bindings**. Devem
aparecer dois, criados sozinhos pela publicação:

- `DB` → D1 database `fabricando3d`
- `BUCKET` → R2 bucket `fabricando3d-arquivos`

**F2.** No sistema, vá em **Precificação**. Ela deve abrir já calculando, com
custo e preço preenchidos. Se aparecer erro de carregar dados, o binding do banco
não pegou — me avise.

**F3.** Me mande o endereço. Eu confiro daqui se a API está mesmo recusando quem
não entrou.

---

## Se der errado

| O que aparece | O que é | O que fazer |
|---|---|---|
| "package.json not found" ou parecido | Root directory vazio ou errado | Ponha `gestao-3d` |
| Erro citando versão do Node | A Cloudflare escolheu uma versão antiga | Adicione a variável de build `NODE_VERSION` = `22` |
| Erro citando `pnpm` | Gerenciador não reconhecido | Ponha `pnpm install --frozen-lockfile` no Install command |
| O site abre mas tudo dá erro 503 | Os bindings não pegaram | Confira o passo F1; se faltarem, adicione à mão com os nomes `DB` e `BUCKET` |
| A tela de primeiro acesso não aparece, e sim a de login | Alguém já criou o acesso | **Me avise na hora.** Pode ser que a janela de risco tenha sido usada |

Em qualquer outro caso: **print da tela**, que eu te digo o que é.

---

## Depois: o domínio

Com o sistema no ar e o acesso criado, aí sim apontamos o `fabricando3d.com.br`.
É um passo separado e sem pressa. Está no `PUBLICAR.md`.
