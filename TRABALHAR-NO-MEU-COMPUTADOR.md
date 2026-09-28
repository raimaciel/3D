# Sair da nuvem e trabalhar no seu computador

O que você quer: parar de gastar os créditos de sessão na nuvem (que cobram em
dólar e estão acabando) e continuar o projeto numa pasta no seu computador.

A Cloudflare **não muda nada**. O sistema publicado continua no ar do mesmo jeito.

---

## Antes de começar: uma condição

O Claude no computador exige um plano **Pro, Max, Team ou Enterprise**. O plano
gratuito do claude.ai **não dá acesso**. Se você já assina um desses, o uso entra
na sua assinatura em vez de consumir os créditos da nuvem.

Se você não assina nenhum, não vai funcionar — e aí vale terminar a publicação
com o crédito que resta antes de decidir.

---

## Passo 1 — Trazer os arquivos (2 minutos, sem terminal)

1. Abra **github.com/raimaciel/3D**
2. Clique no botão verde **`< > Code`**
3. Clique em **Download ZIP**
4. Salve em **Documentos**
5. Clique com o botão direito no arquivo baixado → **Extrair tudo**
6. Renomeie a pasta para **`Fabricando3D`**

Pronto: o projeto inteiro é seu, no seu computador.

**Teste agora:** entre na pasta e dê dois cliques em `calculadora-3d.html`.
Ela abre no navegador e funciona, sem instalar nada.

---

## Passo 2 — Instalar o Claude no computador

**Use o aplicativo de computador (Desktop app). Ele funciona sem terminal**, que
é exatamente o que você precisa.

### Windows

1. Abra **claude.com/download**
2. Baixe o instalador do Windows
3. Dê dois cliques no arquivo baixado e siga a instalação
4. Abra o aplicativo e entre com a sua conta Claude

### Mac

1. Abra **claude.ai/download**
2. Baixe o arquivo `.dmg`
3. Dê dois cliques, arraste o Claude para a pasta Aplicativos
4. Abra e entre com a sua conta Claude

---

## Passo 3 — Abrir o projeto e continuar

No aplicativo, abra a pasta **`Documentos/Fabricando3D`**.

Pronto. A partir daí é só conversar comigo como você faz aqui, mas rodando no seu
computador.

**Uma coisa importante:** a pasta tem o arquivo `CLAUDE.md`. Ele é a memória do
projeto — quem abrir essa pasta lê ali tudo o que já foi decidido: a fórmula de
preço, os defeitos que corrigimos, as suas escolhas, o que falta. Você não vai
precisar explicar nada de novo.

---

## O que continua valendo

| | |
|---|---|
| **Cloudflare** | Sem mudança. O sistema no ar não depende do Claude. |
| **GitHub** | Continua sendo o cofre. Nada se perde. |
| **Créditos da nuvem** | Param de ser gastos assim que você fechar a sessão de lá. |

---

## O que ficou faltando na publicação

Quando você retomar no computador, é isto:

1. **Retry build** na Cloudflare, no commit `6ff18b7` ou mais novo.
2. Abrir `https://3d.ranbm3.workers.dev` e **criar o primeiro acesso**.
   A mensagem de erro agora mostra a causa, se falhar de novo.
3. Conferir no console do banco `fabricando3d`, com `/tables`, que existem as
   quatro tabelas: `workspace`, `users`, `sessions`, `login_attempts`.
4. Apontar o domínio `fabricando3d.com.br`.

Tudo isso está detalhado em `gestao-3d/PASSO-A-PASSO-CLOUDFLARE.md`.
