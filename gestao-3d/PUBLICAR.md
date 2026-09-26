# Publicar o Gestão 3D — sem terminal

Tudo pelo navegador, no painel da Cloudflare. Nada para instalar no computador.

Leia até o fim antes de começar. Na primeira vez leva uns 40 minutos.

---

## Como vamos dividir o trabalho

Algumas coisas só você pode fazer, porque são na sua conta. O resto eu faço.

| Quem | O quê |
|---|---|
| **Você** | Passos 1 a 4: conta, cartão, bucket, banco, tabelas |
| **Eu** | Configuro o repositório com o id do seu banco |
| **Você** | Passos 5 a 8: conectar, publicar, primeiro acesso, domínio |

Faça os passos 1 a 4, me mande o id do banco, e eu te aviso quando puder seguir.

---

## Passo 1 — Conta e cartão

1. Crie a conta em **dash.cloudflare.com** (grátis).
2. Cadastre um cartão na área de **Billing / Faturamento**.

O cartão é exigido para habilitar o R2, que guarda os STL, 3MF e fotos. **Não há cobrança** dentro do limite grátis: 10 GB de espaço e download ilimitado e gratuito. Eu te aviso se o uso chegar perto disso.

## Passo 2 — Criar o lugar dos arquivos (R2)

1. No menu lateral, abra **R2 Object Storage** e ative.
2. Crie um bucket chamado exatamente: `fabricando3d-arquivos`

## Passo 3 — Criar o banco de dados (D1)

1. No menu lateral, abra **Storage & Databases → D1**.
2. Crie um banco chamado exatamente: `fabricando3d`
3. Quando ele abrir, **copie o Database ID**. É um código com traços, parecido com
   `a1b2c3d4-0000-4444-8888-99887766aabb`.

> Esse id não é segredo: ele só identifica o banco, e ninguém acessa nada sem estar
> logado na sua conta. Pode me mandar por aqui sem problema.

## Passo 4 — Criar as tabelas

O banco nasce vazio. Isto é feito **uma vez só**.

1. Ainda no banco `fabricando3d`, abra a aba **Console**.
2. Abra o arquivo **`drizzle/COLAR-NO-CONSOLE-D1.sql`** deste repositório,
   copie a linha **inteira** e cole no campo do console.
3. Clique em **Execute**.

> **Por que este arquivo e não outro:** o campo do console do D1 é de **uma linha
> só**. Se você colar um SQL com quebras de linha e comentários, as quebras somem,
> tudo vira uma linha, e o `--` do primeiro comentário transforma o resto inteiro
> em comentário — o console responde *"The request is malformed: Requests without
> any query are not supported"*. O arquivo `COLAR-NO-CONSOLE-D1.sql` já vem numa
> linha e sem comentário nenhum, justamente para isso.
>
> O `TUDO-colar-no-painel.sql`, mais legível, serve para editores de várias linhas.

Para conferir, rode no mesmo console:

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

Devem aparecer **quatro**: `login_attempts`, `sessions`, `users`, `workspace`.

### ⏸ Pare aqui e me mande o id do banco

Com o id eu configuro o repositório. Aí você segue do passo 5.

---

## Passo 5 — Conectar o repositório

No painel, em **Workers & Pages**, crie um Worker a partir do repositório
`raimaciel/3D` do GitHub. Na configuração:

- **Pasta do projeto (root directory):** `gestao-3d`
- **Comando de instalação:** `pnpm install --frozen-lockfile`
- **Comando de build:** `pnpm build`
- **Comando de deploy:** `npx wrangler deploy --config dist/server/wrangler.json`

Não precisa configurar variável de ambiente nenhuma: o nome do Worker, o banco
`fabricando3d` (id `50c8c520-3ebe-447f-8502-10429660a661`) e o bucket
`fabricando3d-arquivos` já estão gravados no projeto.

## Passo 6 — Ligar o banco e os arquivos

Nas configurações do Worker, na parte de **Bindings**, adicione dois:

| Tipo | Nome do binding | Aponta para |
|---|---|---|
| D1 database | `DB` | `fabricando3d` |
| R2 bucket | `BUCKET` | `fabricando3d-arquivos` |

Os nomes `DB` e `BUCKET` têm que ser **exatamente assim** — é como o código os
procura.

## Passo 7 — Publicar, e criar seu acesso NA MESMA HORA

Mande publicar. Ao terminar, aparece um endereço terminado em `.workers.dev`.

**Abra esse endereço imediatamente e crie seu acesso.**

Não deixe para depois. Enquanto ninguém criar a primeira conta, quem abrir o
endereço pode criá-la no seu lugar e virar o administrador. Depois que você criar,
essa tela fecha para sempre.

> Se preferir fechar essa janela antes de publicar: nas configurações do Worker,
> em **Variables**, adicione um **Secret** chamado `SETUP_TOKEN` com uma frase que
> só você saiba. A tela de primeiro acesso passa a exigir essa frase.

## Passo 8 — Apontar o fabricando3d.com.br

1. Adicione o domínio à sua conta Cloudflare.
2. A Cloudflare vai te dar dois servidores de DNS. Troque-os no site onde você
   registrou o domínio.
3. Quando o domínio ficar ativo, volte no Worker e adicione um **Custom Domain**
   com `fabricando3d.com.br`.

A troca de DNS pode levar de minutos a algumas horas.

---

## Se alguma tela estiver diferente

As telas da Cloudflare mudam de tempos em tempos, e este guia descreve a estrutura,
não os botões exatos. **Me mande um print de qualquer tela que não bater** e eu te
digo onde clicar.

---

## Depois de publicado

- **Backup**: em Configurações → Backup, o sistema exporta tudo num arquivo.
  Faça de vez em quando e guarde fora da Cloudflare.
- **Custo**: zero dentro dos limites grátis.
- **Conferir que está fechado**: me passe o endereço que eu confiro se a API está
  recusando quem não entrou.

---

## Apêndice — pelo terminal

Se um dia você quiser o caminho por linha de comando, ele existe:

```bash
git clone https://github.com/raimaciel/3D.git
cd 3D/gestao-3d
pnpm install --frozen-lockfile
cp .env.exemplo .env          # preencha o CF_D1_ID
npx wrangler login
bash scripts/publicar.sh --simular
bash scripts/publicar.sh
```

Precisa de Node.js 22 e pnpm 11.
