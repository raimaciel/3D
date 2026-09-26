# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este arquivo está em português porque boa parte dele são fatos sobre o negócio que o dono do projeto precisa poder conferir e corrigir.

## O negócio

**Fabricando 3D** é uma empresa de impressão 3D: imprime e modela peças para clientes. O domínio **fabricando3d.com.br** já está registrado e é onde o projeto vai no ar.

O nome do repositório é `3D`, mas isto **não é um projeto de 3D gráfico**. Nenhuma biblioteca de renderização (Three.js, React Three Fiber, Babylon.js) tem papel aqui. O "3D" é o ramo da empresa. Não confunda: essa confusão já aconteceu uma vez nesta sessão.

A empresa **está começando e ainda não tem clientes**. O sistema nasce vazio: não há histórico nem planilha de clientes para importar.

## Ponto de partida: a calculadora (JÁ NO REPOSITÓRIO)

`calculadora-3d.html` é a calculadora de orçamento que o dono construiu antes deste projeto, trazida para cá **byte a byte, sem alteração**. Ela é o ponto de partida do sistema: o pedido dele é evoluí-la, não recomeçar.

**O que ela é tecnicamente:** uma página HTML com CSS e JavaScript embutidos, mais o motor de preço em `precificacao.js` ao lado. Sem framework, sem build, sem dependência externa além das fontes do Google. Estado salvo em `localStorage` (três chaves: `calc3d`, `calc3d-empresa`, `calc3d-tema`). Gera PDF e PNG desenhando num `canvas` e montando os bytes do PDF à mão, sem biblioteca.

**Ela foi feita como Artifact do Claude** e depende de `window.claude.use('downloads')` para salvar arquivo, com fallback para download do navegador. Essa dependência **tem que sair** quando virar sistema — fora do app do Claude ela não existe.

### A fórmula de preço (regra de negócio central — não altere sem o dono)

Custos, por impressão:

| Item | Cálculo |
|---|---|
| Filamento | `peso(g) / 1000 × preço do rolo (R$/kg)` |
| Energia | `potência(W) / 1000 × horas × tarifa (R$/kWh)` |
| Máquina | `valor da impressora / vida útil(h) × horas` |
| Modelagem | `horas de CAD × valor da hora de modelagem` — uma vez no pedido |
| Preparo | `minutos / 60 × valor da hora` — uma vez no trabalho |
| Acabamento | `minutos × quantidade / 60 × valor da hora` — por peça |
| Extras | `embalagem × quantidade` — por peça |
| Falhas | `(Filamento + Energia + Máquina + Preparo + Acabamento) × margem de falha %` |

`custo da peça = (soma de todos os itens) / quantidade`

Preço de venda:

```
preço = (custo × (1 + ROI)) + (taxa fixa / quantidade)
        ----------------------------------------------
        1 − imposto% − marketplace% − (1 / ROAS)
```

Com trava: se `imposto + marketplace + 1/ROAS >= 95%`, o preço é bloqueado e um erro aparece, porque não sobraria margem.

**Essa fórmula está matematicamente correta e foi verificada numericamente**: o lucro dividido pelo custo devolve exatamente o ROI pedido, inclusive com imposto, marketplace, ROAS e taxa fixa atuando juntos. É o acerto mais importante dela — a margem é aplicada *por fora* das taxas, não por dentro. **Preserve esse comportamento em qualquer reescrita** e teste contra estes valores antes de considerar a migração correta.

Dados de referência embutidos no arquivo, que valem migrar: tarifa média de energia dos 27 estados e consumo em watts de 30 modelos de impressora por marca (a **Bambu Lab A1**, a máquina da casa, está lá com 150 W).

### Decisões de precificação tomadas pelo dono (já implementadas)

Dois defeitos do modo lote foram encontrados, confirmados por teste e corrigidos. As quatro decisões abaixo são **dele**, não suposições — respeite-as:

1. **Trabalho humano tem três escopos distintos**, e confundi-los foi a origem do defeito antigo:
   - `Acabamento` — por peça (tirar suporte, lixar, montar). **Multiplica pela quantidade.**
   - `Preparo` — uma vez no trabalho (fatiar, montar a mesa, trocar filamento). **Não multiplica.**
   - `Modelagem` — uma vez no pedido, com **valor de hora próprio**, separado da mão de obra. Cobre a venda de modelagem sob encomenda.
2. **Taxa fixa é por venda**, então é rateada entre as peças do lote, não cobrada em cada uma. O dono não usa o campo hoje; foi corrigido mesmo assim, porque o erro era de 20× num lote de 20 e ficaria esperando o dia em que ele vendesse por marketplace.
3. **A margem de falha cobre o trabalho humano** (acabamento e preparo), além de material, energia e máquina.
4. **A margem de falha NÃO cobre modelagem nem embalagem.** Modelagem fica de fora porque o arquivo CAD sobrevive a uma impressão perdida — não se remodela. Embalagem fica de fora porque a peça perdida nunca chegou a ser embalada. Essa distinção foi decisão de projeto; não a desfaça por engano ao mexer no cálculo.

### Identidade visual já estabelecida

A calculadora já define a marca, e o sistema deve seguir: azul-marinho `#132840`, turquesa `#1CB8C4`, fundo claro `#EEF2F6`, fontes **Sora** (títulos e números) e **Figtree** (texto). Tem tema claro e escuro funcionando e layout que já responde bem no celular.

### Semânticas que divergiam e como ficaram

Ao ligar a tela, apareceram diferenças de convenção entre os dois sistemas. Ficou assim, e **os rótulos da tela dizem o escopo de propósito** — confundir escopo foi a origem do erro de 20× na calculadora antiga:

| | Como ficou | Observação |
|---|---|---|
| Peso e tempo | **por peça** | Como o Gestão 3D já fazia e como o produto cadastrado guarda. A conversão para o total do trabalho mora só em `calculate()`, em `lib/domain.ts`. |
| Potência | **watts** | Era kW no Gestão 3D. O cadastro de impressora também mudou para W. |
| Embalagem | **por peça** | **Mudança de comportamento**: o Gestão 3D cobrava uma vez por pedido. |
| Acabamento | por peça | Campo novo, separado do preparo. |
| Preparo | uma vez | Campo novo. |
| Personalização | escopo escolhido | Mantido do Gestão 3D, que nisso era melhor. |
| Preço | **calculado** | O campo de digitar preço não existe mais. |

### Onde a migração está

O plano era extrair o motor de preço, provar com teste que nada quebrou, e só então construir o sistema em volta. **Os dois primeiros passos estão feitos:**

- `precificacao.js` — o motor, lógica pura, sem nenhuma referência a tela. Roda no navegador como `<script>` e no Node via `require`.
- `teste-precificacao.js` — 52 testes, sem biblioteca nenhuma. Guarda a identidade central (lucro ÷ custo = ROI pedido) em 30 combinações de taxas, as duas correções, os escopos de trabalho, a regra da margem de falha, as travas de divisão por zero, e uma cópia da **fórmula original** para que qualquer divergência futura apareça como diferença explicada.

**O passo 3 também está feito**: a tela de precificação foi ligada ao motor. `lib/domain.ts` já não tem cálculo próprio — `calculate()` só adapta os campos da tela e delega. Os painéis de **Modelagem** e **Venda** (ROI, imposto, marketplace, taxa fixa, ROAS) são novos, e o preço saiu de campo digitado para número calculado.

Verificado em Chromium, em 1400 px e em 390 px: a tela carrega sem erro de JavaScript, os números batem com o motor, e o escopo dos campos se comporta como o rótulo promete — num lote de 20, o acabamento multiplicou por 20 e o preparo ficou parado.

**O login está feito.** Falta a hospedagem.

## O OUTRO ponto de partida: o Gestão 3D (JÁ NO REPOSITÓRIO, em `gestao-3d/`)

O dono **já tinha um sistema de gestão quase completo**, feito no construtor de apps do ChatGPT, importado aqui sem alteração. Ele cobre quase todos os módulos da lista: clientes, fornecedores, materiais com estoque e compras, impressoras, produtos, orçamentos, pedidos, produção em etapas e financeiro. Tem manual de uso em `gestao-3d/docs/`.

**Não construa esses cadastros do zero.** O trabalho aqui é migrar e corrigir, não recomeçar.

**O que é tecnicamente:** Next.js 16 + React 19 sobre **Cloudflare Workers**, via `vinext` (beta), com banco **D1** (binding `DB`) e arquivos em **R2** (binding `BUCKET`). Drizzle ORM, shadcn/ui, Tailwind 4. Rodava em `gestao3d-maciel.raimaciel.chatgpt.site`.

**Verificado neste contêiner:** `pnpm install` e `pnpm build` passam com Node 22, e `pnpm start` sobe o servidor local. O pacote é válido e compila.

### Três problemas graves, verificados na prática

**1. Não existia autenticação nenhuma — RESOLVIDO.** *(O relato abaixo fica como registro do que foi encontrado; veja "Autenticação" mais adiante para como ficou.)* `app/chatgpt-auth.ts` existe mas **nenhum arquivo o importa** — é código morto. Provado com o servidor rodando localmente:

- `GET /api/workspace` sem cabeçalho nenhum devolveu **HTTP 200 com o banco inteiro**.
- `POST` de um cliente novo via `curl`, sem login, **gravou e persistiu** (revisão foi de 0 para 1).

A única defesa é `if(origin && origin !== ...)` nas rotas, e ela **não protege nada**: `curl` não manda cabeçalho `Origin`, então a condição é falsa e a requisição passa. No Sites da OpenAI havia login da plataforma na frente; fora dela, **publicar isto é expor e deixar editável todo o cadastro de clientes, pedidos e financeiro da empresa**. Resolver isto é pré-requisito de qualquer publicação, não melhoria futura.

**2. O banco inteiro é uma linha só.** Tabela `workspace`, campo `data` com o estado completo em JSON. Não há tabela de cliente, pedido ou estoque — nada é consultável por SQL, e cada gravação reescreve tudo. Há trava otimista por `revision`: se duas pessoas salvarem ao mesmo tempo, a segunda leva erro 409 e perde o que digitou. Com equipe **e** clientes acessando, como está planejado, isso vai doer. Um modelo relacional de verdade é o que destrava o RLS ("cliente vê só o pedido dele"), que neste formato é impossível.

**3. Duas fórmulas de preço incompatíveis convivem no projeto.** Esta é a decisão mais urgente de produto.

| | `precificacao.js` (a calculadora) | `gestao-3d/lib/domain.ts` |
|---|---|---|
| Preço de venda | **calculado** a partir do ROI, sobrevivendo a imposto, marketplace e ROAS | **digitado à mão**; o sistema só mostra a margem depois |
| Margem de falha | material + energia + máquina + preparo + acabamento | **só o material** |
| Hora de máquina | `valor da impressora ÷ vida útil` | taxa por hora digitada |
| Manutenção | não existe | % sobre material + energia |
| Pintura | não existe | por peso, com taxa própria |
| Embalagem | por peça | **uma vez no pedido** |
| Energia | potência em **watts** | potência em **kW** (padrão 0.5) |
| Modelagem | uma vez no pedido | `customScope`: por pedido **ou** por peça |

A diferença de unidade de energia é uma armadilha real: digitar `150` num campo pensando no outro sistema erra a conta em 1000×. E as duas filosofias são opostas — uma calcula o preço, a outra só confere a margem. **Não escolha por conta própria qual vale; é decisão do dono.** O `customScope` do Gestão 3D é mais completo que a calculadora nesse ponto e vale aproveitar.

### Dados: risco imediato

Os dados reais **não estão no pacote** — ficaram no D1 da hospedagem de origem. O sistema tem exportação (Configurações → Backup → Exportar dados) mas **não tem importação**. Fotos e logo estão no R2, à parte. Exportar antes de perder acesso à hospedagem original é urgente; escrever a rotina de importação é trabalho a fazer.

## Decisões de rumo tomadas pelo dono

Estas três fecham questões que estavam em aberto. São dele; não as reabra por conta própria.

**1. A fórmula de preço da calculadora é a que vale.** *(FEITO: motor em `gestao-3d/lib/precificacao.ts`, tela ligada, verificada em navegador.)* O preço passa a ser **calculado a partir do ROI**, sobrevivendo a imposto, marketplace e ROAS, e não mais digitado à mão como no Gestão 3D. O motor é `precificacao.js`, que já está testado — leve-o para dentro do sistema, não reescreva.

Interpretação aplicada, sujeita a correção dele: a decisão é sobre **como o preço é derivado**, não sobre quais custos existem. Então as linhas de custo que só o Gestão 3D tem (**manutenção** como % sobre material e energia, **pintura** por peso) devem ser preservadas como itens de custo adicionais — elas não conflitam com o método, só somam. O `customScope` (por pedido ou por peça) do Gestão 3D também é melhor que o equivalente da calculadora e deve ficar.

Cuidado ao unificar: a potência é em **watts** na calculadora e em **kW** no Gestão 3D. Padronizar e converter os valores salvos, ou a conta erra em 1000×.

**2. A hospedagem é a Cloudflare, usando tudo o que ela oferece.** Pedido do dono, textual: banco de dados, R2 para PDFs **e arquivos 3D do cliente (STL/3MF)**, geração de pedido em PDF e hospedagem do site — tudo lá.

*(A rota de arquivos já aceita STL e 3MF — veja "Arquivos" adiante.)* Para o PDF, a técnica da `calculadora-3d.html` (desenhar em canvas e montar os bytes do PDF à mão, sem biblioteca) já está no repositório e pode ser reaproveitada; o `manager.tsx` também já tem um modelo de impressão. O app já foi feito para Workers + D1 + R2, então fica onde está. A recomendação anterior de Next.js + Supabase + Vercel, feita antes de o Gestão 3D aparecer, **está descartada**: migrar de stack jogaria fora um sistema que já funciona. O domínio `fabricando3d.com.br` aponta para a Cloudflare.

**3. Não há mais acesso à hospedagem original, e os dados antigos se perderam.** Consequências: o sistema **nasce vazio**, e **não é preciso escrever rotina de importação** — o que era trabalho previsto e deixou de ser. A empresa estava começando, então a perda é pequena.

Risco em aberto: se o site antigo continuar no ar sem que o dono consiga entrar para removê-lo, ele segue exposto, com os problemas de autenticação descritos acima.

## O que vamos construir

Um **sistema de gestão** junto com o site público, em **um único projeto com área de login**:

- **Parte pública** — vitrine das peças e porta de entrada para pedidos. Precisa ser encontrável no Google, então o conteúdo público tem que ser renderizado no servidor.
- **Área interna (equipe)** — a gestão do dia a dia.
- **Área do cliente** — o cliente acompanha o próprio pedido.

Módulos confirmados pelo dono (quase todos **já existem** no `gestao-3d/` — migrar, não refazer):

1. **Orçamentos e pedidos** — evolução da calculadora existente.
2. **Clientes e histórico** — cadastro com contato e tudo que cada cliente já encomendou.
3. **Fornecedores** — de quem se compra filamento e insumos.
4. **Usuários** — quem acessa o sistema e com que permissão.
5. **Estoque de filamento** — quanto existe de cada cor e tipo, quanto cada peça consumiu, aviso quando acabar.
6. **Fila das impressoras** — o que está imprimindo e quanto falta.

Precisa funcionar **online, no celular e no PC** — o dono usa o celular na oficina, então as telas se desenham para tela pequena primeiro.

## Como o trabalho chega

**Os dois casos acontecem:**

- Cliente manda o **arquivo pronto** (STL/3MF) e é só imprimir.
- Cliente **encomenda a modelagem**: descreve, manda foto ou desenho, e a peça é modelada antes de imprimir.

Consequências para o orçamento: a modelagem é **hora de trabalho** e entra na conta separada do material; e o modelo precisa de **aprovação do cliente antes de gastar filamento**, senão o refugo sai do bolso da empresa.

Canais de entrada previstos: **WhatsApp, Instagram e presencial/indicação**.

Isso tem uma consequência que não pode ser esquecida: **o pedido tem que poder ser lançado à mão, rápido, pelo celular.** Não assuma que todo pedido nasce de um formulário no site — a maioria vai nascer de uma conversa no WhatsApp. Sistema que só aceita pedido por formulário não serve para esta empresa.

## Parque de máquinas e materiais

- **Uma impressora: Bambu Lab A1** (FDM, filamento).
- **Materiais em uso: PLA, PETG, ABS/ASA.**
- **Resina é plano futuro, não presente.** Não construa agora estoque em mililitros nem etapa de lavagem e cura no prazo. Mas deixe o cadastro de materiais extensível, para aceitar resina sem reescrever o modelo de dados.

Observação técnica registrada e ainda não respondida pelo dono: a **A1 é aberta, sem câmara fechada**, e ABS/ASA empenam nessas condições. Se a empresa vende essas peças, o risco de refugo deveria aparecer no preço. Vale confirmar com ele quando o cálculo de orçamento for mexido.

## Quem mantém este código

O dono é **iniciante em programação**, mas **não é iniciante em impressão 3D**. Trate as duas coisas diferente:

- Vocabulário do ramo (FDM, resina, STL, filamento, fatiamento) pode ser usado à vontade.
- Vocabulário de programação precisa ser explicado, em português, sem jargão solto.
- Cuide você da configuração de ambiente, instalação e deploy. Não entregue passo manual que dependa de conhecimento que ele não tem.
- Prefira código claro e óbvio a código curto e esperto.
- Menos peças móveis vence flexibilidade. Cada serviço ou biblioteca a mais é mais uma coisa que ele vai ter que entender sozinho quando quebrar.

## Stack (decidida)

**Cloudflare Workers + D1 + R2**, que é onde o `gestao-3d/` já roda: Next.js 16, React 19, `vinext`, Drizzle, shadcn/ui, Tailwind 4. Node 22 e pnpm 11.

A recomendação anterior deste arquivo (Next.js + Supabase + Vercel) foi escrita antes de o Gestão 3D existir no repositório e **não vale mais**. Não a ressuscite.

**Ressalva honesta a manter na mesa:** o dono é iniciante e esta stack não é simples — Workers, D1, R2 e um `vinext` ainda em beta. O caminho se justifica porque o sistema já existe e funciona nela. Se em algum momento a prioridade virar "preciso disso funcionando agora", a troca por algo mais simples precisa ser oferecida de novo, não escondida.

## O que ainda não se sabe — não invente

- **Fornecedores**: não se sabe se basta cadastro de contato ou se ele quer preço por fornecedor e histórico de compra.
- **Volume esperado de pedidos**: não perguntado. Muda o quanto de automação se justifica.
- **ABS/ASA na A1 aberta**: a máquina não tem câmara fechada e essas peças empenam. Se a empresa as vende, o risco de refugo deveria estar no preço. Levantado com o dono, ainda sem resposta.

## Arquivos: STL, 3MF e fotos (feito)

O dono perguntou se dava para guardar os arquivos 3D no Google Drive, achando que sairia mais barato. **Sai mais caro e mais frágil**, e a decisão foi ficar no R2:

- **R2 grátis**: 10 GB dedicados, 1 M escritas, 10 M leituras por mês e **saída de dados gratuita**. Um STL tem de 1 a 20 MB, então cabem centenas de arquivos. Acima disso, US$ 0,015 por GB-mês.
- **Drive grátis**: 15 GB **compartilhados com Gmail e Fotos**, ou seja, menos na prática.
- A maioria dos serviços cobra pelo **download**; o R2 não. Num sistema de impressão 3D, é aí que o gasto apareceria.
- E o Drive exigiria OAuth: com a tela de consentimento em "Testing", o *refresh token* **expira a cada 7 dias**, quebrando o upload semanalmente até alguém reautorizar. Sair disso exige publicar o app e passar pela verificação do Google.

Se um dia ele quiser os arquivos visíveis no próprio Drive, o caminho é **cópia só de ida** a partir do R2, nunca trocar o R2 pelo Drive.

**`lib/arquivos.ts`** decide o que entra, e **`lib/arquivos.teste.ts`** tem 35 testes. A armadilha que ele resolve: **o navegador não informa tipo confiável para STL e 3MF** — o campo vem vazio, vem `application/octet-stream` ou vem inventado. Então a conferência é por **extensão mais assinatura do conteúdo**, nunca pelo que o navegador afirma:

- **STL binário** não tem assinatura. Reconhece-se pela aritmética do próprio formato: 80 bytes de cabeçalho + 4 da contagem de triângulos + 50 por triângulo. Se a conta fecha com o tamanho do arquivo, é STL de verdade.
- **STL em texto** começa com `solid`.
- **3MF** é um pacote ZIP, então tem a assinatura `PK\x03\x04`.
- Imagens pelas assinaturas usuais.

Isso barra o ataque de renomear: um `.exe` chamado `peca.stl` passa pela extensão e **morre na assinatura** — há teste provando.

Limites: **50 MB** para modelo, **5 MB** para imagem. O arquivo **não é carregado inteiro na memória**: só os primeiros 4 KB entram, para a conferência, e o resto vai em fluxo para o R2. Verificado com um STL real de 40 MB, que subiu em 1,5 s e voltou byte a byte idêntico, sem erro de memória.

No download, modelo vai como **anexo com o nome original** (o navegador não sabe exibir STL) e imagem vai embutida. `nomeSeguro()` tira acento e bloqueia caminho, aspas e quebra de linha antes de o nome entrar no cabeçalho.

## Autenticação (feita)

Sessão própria, guardada no D1. Nada de serviço externo: menos uma peça para o dono manter.

| Arquivo | Papel |
|---|---|
| `lib/auth.ts` | senha e token. Sem nenhuma referência à Cloudflare, por isso é testável no Node. |
| `lib/sessao.ts` | sessão no banco, cookie, e as guardas `exigirUsuario` / `exigirEquipe` / `origemInvalida`. |
| `lib/limite.ts` | trava de força bruta por e-mail. |
| `app/api/auth/*` | `setup`, `login`, `logout`, `me`. |
| `app/acesso.tsx` | a tela de entrada e a de primeiro acesso. |

Decisões que **não devem ser desfeitas sem pensar**:

- **Senha**: PBKDF2-SHA256, que é o que o Workers oferece nativamente, com sal por senha. O número de iterações fica **gravado dentro do hash**, então dá para aumentá-lo depois sem invalidar senha nenhuma — o login antigo confere com o número dele e regrava no formato novo.
- **O cookie leva o token; o banco guarda o SHA-256 dele.** Quem ler a tabela `sessions` não consegue se passar por ninguém.
- **Origin é obrigatório** em toda requisição que altera dados. A checagem antiga (`if(origin && ...)`) aceitava Origin ausente, o que a tornava inútil.
- **Mesma mensagem e mesmo tempo** para e-mail inexistente e senha errada. O tempo importa tanto quanto a mensagem: sem um hash descartável no caminho do e-mail inexistente, o relógio entrega quais e-mails existem.
- **Primeiro acesso**: a rota `setup` só funciona enquanto não há nenhum usuário, e a condição está dentro do próprio `INSERT`, o que fecha a corrida de dois cadastros ao mesmo tempo. Se a variável `SETUP_TOKEN` estiver configurada no provedor, ela também é exigida.

**Risco que sobra, e é real:** entre publicar e criar o primeiro acesso, quem abrir o endereço pode criá-lo no seu lugar. Ou se configura `SETUP_TOKEN` antes de publicar, ou se cria o acesso imediatamente depois. A tela avisa isso em destaque.

**Cuidado com o plano do Workers:** o login gasta ~30 ms, quase tudo em PBKDF2. O plano grátis limita CPU por requisição; se o login começar a falhar por isso, baixe `ITERACOES_PADRAO` em `lib/auth.ts` — as senhas já gravadas continuam valendo.

**Ainda não existe portal do cliente.** O papel `cliente` existe no banco, mas `exigirEquipe` barra qualquer um que não seja `admin` ou `equipe`. Abrir para cliente depende do banco relacional: com o estado todo num JSON só, não há como mostrar a ele apenas o pedido dele.

## Segurança que este projeto exige de verdade

O cliente acessa o sistema. "Cliente vê apenas os próprios pedidos" não é detalhe de interface — tem que valer no banco, com RLS, não apenas escondendo botões na tela. Um pedido vazado é dado comercial de outro cliente.

## Estado atual do repositório

```
calculadora-3d.html     a calculadora de orçamento, funcionando
precificacao.js         o motor de preço da calculadora, lógica pura
teste-precificacao.js   52 testes do motor, sem dependências
gestao-3d/              o sistema de gestão
  lib/precificacao.ts        o motor de preço unificado (é este que vale)
  lib/precificacao.teste.ts  33 testes do motor
  lib/auth.ts                senha e token de sessão
  lib/auth.teste.ts          36 testes de autenticação
  lib/sessao.ts              sessão no banco e guardas das rotas
  lib/limite.ts              trava de força bruta
  lib/arquivos.ts            o que entra: STL, 3MF e imagens, por assinatura
  lib/arquivos.teste.ts      35 testes de validação de arquivo
  app/acesso.tsx             tela de entrada e de primeiro acesso
  scripts/teste-acesso.sh    prova que a API está fechada
CLAUDE.md               este arquivo
README.md               só o título
```

**Rodar a calculadora:** abrir `calculadora-3d.html` no navegador. Não precisa instalar nada. `precificacao.js` tem que estar na mesma pasta.

**Rodar os testes da calculadora:** `node teste-precificacao.js` → `52 passaram, 0 falharam`. Verificado.

**Rodar o Gestão 3D** (dentro de `gestao-3d/`, com Node 22 e pnpm 11) — todos verificados neste contêiner:

```
pnpm install --frozen-lockfile
pnpm build
npx wrangler d1 execute site-creator-d1 --config dist/server/wrangler.json \
  --local --persist-to .wrangler/state --file drizzle/0000_small_solo.sql
pnpm start      # sobe em http://127.0.0.1:8787
```

As migrações só são necessárias na primeira vez; sem elas a API responde 503. **São duas**: a segunda cria as tabelas de login.

**Rodar os testes do motor unificado** (dentro de `gestao-3d/`):

```
node --experimental-strip-types lib/precificacao.teste.ts
```

Sai `33 passaram, 0 falharam`. E os da autenticação:

```
node --experimental-strip-types lib/auth.teste.ts
```

Sai `36 passaram, 0 falharam`. E os de arquivo:

```
node --experimental-strip-types lib/arquivos.teste.ts
```

Sai `35 passaram, 0 falharam`. Com o sistema no ar, `bash scripts/teste-acesso.sh http://127.0.0.1:8787` confere que a API recusa quem não entrou: `9 passaram, 0 falharam`. Todos verificados. O primeiro teste prova que o motor unificado devolve número **idêntico** ao da calculadora em cinco cenários, com os recursos exclusivos do Gestão 3D desligados.

**Dívida pré-existente:** `npx tsc --noEmit` acusa **7 erros de tipo em `lib/domain.ts`**, em `supplierId`, `spoolCount` e `spoolWeight` sobre um tipo união. Vieram assim do construtor do ChatGPT, não foram introduzidos aqui. O build passa mesmo assim porque o Vite remove os tipos sem conferir. Vale pagar essa dívida quando a tela for mexida.

**O que ainda não existe:** um sistema único. Hoje são duas peças separadas, com fórmulas de preço que discordam, e a de gestão sem autenticação nenhuma. Nada está publicado, e nada deve ser publicado antes do login existir.

## Git

- Branch padrão: `main`.
- Sessões do Claude Code desenvolvem em branches `claude/*`, sem commitar direto na `main`.
