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

## Precificação: apagada em 28/09 e REFEITA em 29/09/2026

**Estado atual: a Precificação nova existe**, em `gestao-3d/app/precificacao.tsx`, escrita de forma legível (não nas linhas gigantes do `manager.tsx`). Foi desenhada com o dono a partir de quatro calculadoras que ele indicou (Onyon 3D, 3DCerrado, 3D Print Studio, Calcula-AI) e aprovada por rascunho no celular e no computador antes de ser programada.

- **Celular primeiro:** uma coluna, com a barra do preço presa no rodapé. No computador (a partir de 1000 px), o resultado vira coluna fixa à direita.
- **Filamento e impressora vêm do cadastro**, sem preço fixo: são **menus com setinha** (o dono pediu: botões ocupavam espaço demais). Com um cadastro só, já vem escolhido. O preço por kg vem **só** do menu: o campo separado de preço por kg foi tirado a pedido do dono, porque repetia a informação. Para mudar o preço, muda-se o cadastro do filamento.
- **A hora de máquina sai do cadastro da impressora:** o cadastro ganhou `value` (valor pago) e `lifeHours` (vida útil), e a hora vira valor ÷ vida útil. Se `machineRate` for digitado, ele manda.
- **Informar por peça ou por lote** (botões "Por peça" e "Por lote"; o dono pediu esses nomes, não "mesa inteira"). Em Lote, digita-se o peso e o tempo **totais** do lote, como o fatiador mostra com a mesa cheia, e a tela divide pela quantidade e mostra "= 8 g e 27 min por peça". Mudar a quantidade no modo Lote mantém o total e redivide. O motor sempre recebe por peça; a divisão mora só na tela.
- **Tempo em horas e minutos**, dois campos. Antes era um campo em horas decimais, e o dono digitou "1,45" querendo 1 h 45 min, e a tela entendeu 1 h 27 min.
- **Botões de ROI de 20%, 30%, 35%, 50%, 100%, 150% e 200%** (pedido do dono), mais um campo livre. Começa em 100%.
- **Exemplos prontos:** chaveiro, peça técnica, miniatura, decoração, e **Outro**, que limpa nome, peso e tempo para digitar livre (pedido do dono).
- **Seções recolhidas e já preenchidas:** máquina e energia, mão de obra e modelagem, falha, embalagem e acabamentos, venda. A hora de trabalho é campo livre.
- **O resultado mostra** preço, custo, lucro, lucro por hora, preço mínimo, lote, de onde vem o custo, e "o cliente pediu outro preço?".
- **Orçamento em preparação** na mesma tela: cliente, prazo, observações, anexo STL/3MF por peça, salvar.
- **Tarifa de energia padrão: R$ 1,12/kWh** (Enel Ceará), só para instalação nova. **Quem já tem Configurações salvas continua com o valor salvo** (o de teste está em 1,10). O dono muda em Configurações.

**O motor não mudou:** `lib/precificacao.ts` voltou do commit `d3d70c1`, com os mesmos 49 testes. Custo fixo do mês existe no motor mas não na tela (o dono não pediu de volta). A leitura do fatiador **não** voltou.

Verificado no navegador: calcular um chaveiro, lote de 10, salvar o orçamento #001 e vê-lo em Orçamentos. Largura de 375 px sem rolar para o lado.

### Registro da exclusão de 28/09 (histórico)

O dono mandou apagar o módulo inteiro de Precificação do Gestão 3D para **criar outro do zero**. Pedido textual: "apague cada coisa desse módulo, não só tira a tela, quero eliminar, vamos criar outra".

**O que foi apagado:** a tela (painéis de peça, máquina, acabamento, personalização, modelagem, venda, o cartão do preço e o "Orçamento em preparação"), a lógica dela no `manager.tsx` (estado, `addItem`, `saveQuote`), `lib/precificacao.ts` e seus 49 testes, `lib/fatiador.ts` e seus 24 testes, `app/precificacao-extras.tsx`, `calculate()`/`defaults`/`analyzeOffer()` do `lib/domain.ts`, o custo fixo do mês nas Configurações, e 107 regras de CSS que só a tela usava.

**O que ficou, de propósito:**
- O **nome** "Precificação" no menu, com um aviso de reconstrução.
- `calculationSchema` e o tipo `Calculation` em `lib/domain.ts`: são o **formato dos itens já salvos**, que Orçamentos, Pedidos, Produção e o PDF do orçamento ainda leem.
- A ação `quote` do servidor existe, mas **recusa** com "Criar orçamento está desativado enquanto a Precificação é refeita". Aprovar orçamento, pedidos, produção e financeiro seguem funcionando.
- Os **Parâmetros de custo** das Configurações (energia, hora de máquina, mão de obra, manutenção, pintura): são do módulo Configurações e guardam os valores do dono.
- A **calculadora original** na raiz (`calculadora-3d.html`, `precificacao.js`, `teste-precificacao.js`, 52 testes) ficou **intocada**. É ali que a fórmula verificada continua viva.
- O sistema agora abre na **Visão geral**.

**Para recuperar qualquer peça apagada:** tudo está no commit `d3d70c1`, no ramo `claude/computador-windows`. Exemplo: `git show d3d70c1:gestao-3d/lib/precificacao.ts`.

As seções abaixo sobre fórmula, escopos e melhorias descrevem **o módulo apagado**. Continuam valendo como conhecimento do negócio (as decisões de preço são do dono), mas **o código a que se referem não existe mais** no `gestao-3d/`.

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
| Lucro | **por peça e do lote**, os dois | O dono vende peça avulsa e lote. O rótulo antigo, "Lucro estimado", mostrava o lucro do lote ao lado do preço por peça, e o lucro parecia maior que o preço. Agora aparece "Lucro por peça" sempre e "Lucro do lote (N peças)" quando a quantidade passa de 1. |

### Melhorias da precificação (28/09/2026)

O dono pediu para comparar com quatro calculadoras do mercado (STLFLIX, Objeto3D, Calc3D, 3D Print Studio) e melhorar a nossa **sem ficar perguntando**. Na fórmula, a nossa já era a mais correta das cinco: só ela aplica a margem por fora das taxas. O que entrou:

- **Exemplos prontos** (chaveiro, lote de chaveiros, peça técnica, miniatura, decoração): preenchem peso, tempo, quantidade e acabamento típicos da A1. São ponto de partida, e a tela diz isso. Os números estão em `PONTOS_DE_PARTIDA`, em `app/precificacao-extras.tsx`.
- **Ler peso e tempo do fatiador**: lê o `.gcode.3mf` do Bambu Studio (o arquivo `Metadata/slice_info.config` de dentro do ZIP) ou um `.gcode` do Bambu, Orca, Prusa ou Cura. É lido **no navegador, sem enviar**. O fatiador dá o total da **mesa**; a tela divide pelo número de peças da mesa e mostra a conta que fez. **Ainda não foi testado com um arquivo real da A1 do dono**: os testes usam arquivos montados no formato documentado. O Cura não informa peso em gramas, e a tela avisa em vez de inventar.
- **"O cliente pediu outro preço?"**: digita-se um preço, e a tela mostra lucro, ROI e se está abaixo do preço mínimo. Não mexe no preço calculado. Motor: `analisarPreco()`.
- **Preço mínimo** (ROI zero) e **lucro por hora de impressora**, no painel do preço. Com uma A1 só, o tempo de máquina é o gargalo.
- **Custo fixo do mês** (DAS do MEI, internet, assinaturas) ÷ peças feitas por mês, como linha de custo nova. O padrão fica em Configurações. **Começa em zero**, então nenhum preço existente mudou.

Decisões tomadas por mim, sem consultar, que o dono pode reverter:
- **O custo fixo fica fora da margem de falha**, porque a conta do mês não cresce quando uma peça falha. Mesma lógica da embalagem.
- **Correção de defeito antigo:** o "lucro" da tela era receita menos custo, **sem descontar** imposto, marketplace, anúncio e taxa fixa. Com taxas acima de zero, a tela mostrava lucro maior que o real. Agora vem do motor, já descontado. Os orçamentos salvos não mudam: eles guardam custo e receita, que estavam certos.

Ficaram de fora, porque mudariam preços que já existem ou dependem de como ele vende: embalagem e frete **sem margem** (o Objeto3D faz assim; aqui a embalagem recebe o ROI), e **preço de lojista** (STLFLIX).

### Onde a migração está

O plano era extrair o motor de preço, provar com teste que nada quebrou, e só então construir o sistema em volta. **Os dois primeiros passos estão feitos:**

- `precificacao.js` — o motor, lógica pura, sem nenhuma referência a tela. Roda no navegador como `<script>` e no Node via `require`.
- `teste-precificacao.js` — 52 testes, sem biblioteca nenhuma. Guarda a identidade central (lucro ÷ custo = ROI pedido) em 30 combinações de taxas, as duas correções, os escopos de trabalho, a regra da margem de falha, as travas de divisão por zero, e uma cópia da **fórmula original** para que qualquer divergência futura apareça como diferença explicada.

**O passo 3 também está feito**: a tela de precificação foi ligada ao motor. `lib/domain.ts` já não tem cálculo próprio — `calculate()` só adapta os campos da tela e delega. Os painéis de **Modelagem** e **Venda** (ROI, imposto, marketplace, taxa fixa, ROAS) são novos, e o preço saiu de campo digitado para número calculado.

Verificado em Chromium, em 1400 px e em 390 px: a tela carrega sem erro de JavaScript, os números batem com o motor, e o escopo dos campos se comporta como o rótulo promete — num lote de 20, o acabamento multiplicou por 20 e o preparo ficou parado.

**O login está feito, e o sistema está no ar** em `https://3d.ranbm3.workers.dev` (veja "Publicação"). Falta apontar o domínio.

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

### Onde o anexo aparece na tela

O arquivo pertence ao **item do orçamento**, não ao pedido: o STL é de uma peça específica, e assim ele viaja junto dela da precificação até a produção. `Item.arquivos` é uma lista de `{url, nome}`, validada por `arquivoSchema` em `lib/domain.ts` (a url tem que casar com `/api/files/<uuid>`).

O fluxo verificado de ponta a ponta no navegador: anexar na tela de precificação → o item vai para o carrinho com o contador de anexos → salvar o orçamento → aprovar → o arquivo aparece no pedido, na produção, e baixa **byte a byte idêntico** ao que o cliente mandou.

Ainda **não há** como anexar a um pedido já existente (caso do cliente que manda o arquivo depois da aprovação). Isso pede uma ação nova no domínio, no molde da ação `photo`, que já faz exatamente isso para fotos de produção.

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

**O limite de CPU do Workers já mordeu, em produção.** O plano grátis dá **10 ms de CPU por requisição**. Com `ITERACOES_PADRAO = 150_000`, o cadastro do primeiro acesso falhou com 503 no ar, embora funcionasse perfeitamente no ambiente local, que não tem esse limite. Medido aqui: 150.000 → 35 ms, 40.000 → 9 ms, 15.000 → 3,6 ms.

O valor atual é **15.000**, que é baixo para PBKDF2 e é **uma concessão ao plano grátis, não uma escolha de segurança**. Compensam parcialmente: senha de no mínimo 10 caracteres, trava após 8 tentativas por e-mail, e o hash nunca exposto.

**Caminho de volta, já preparado:** com o Workers Paid (US$ 5/mês) o limite vai a 30 s. Basta trocar o número por 300_000 e publicar — nenhuma senha é invalidada, porque o número de iterações fica gravado dentro de cada hash e as antigas são regravadas no próximo login de cada pessoa. Foi para isso que o formato foi desenhado assim.

**Lição de método:** o ambiente local não tem limite de CPU, então ele não reproduz essa classe de falha. Teste local passando não prova que o Workers aguenta.

**Trocar senha e recuperar acesso (30/09/2026), pedido do dono antes de publicar.** Sem serviço de e-mail, de propósito (seria mais uma peça para manter): a recuperação é por **código de recuperação**.
- **Trocar senha**: Configurações → Seu acesso (`app/conta.tsx`), rota `POST /api/auth/senha`. Pede a senha atual; depois de trocar, **desconecta os outros aparelhos** (`encerrarOutrasSessoes` em `lib/sessao.ts`).
- **Código de recuperação**: gerado no mesmo painel, pedindo a senha (rota `/api/auth/codigo`: GET diz se existe e quando foi gerado; POST gera). 16 caracteres sem letras ambíguas, formato `ABCD-EFGH-JKLM-NPQR`, 80 bits; aparece **uma vez só**; o banco guarda só o SHA-256. Gerar outro invalida o anterior. Funções em `lib/auth.ts` (`novoCodigoRecuperacao`, `normalizarCodigo`), 8 testes novos (45 no arquivo).
- **"Esqueci minha senha"** na tela de entrada (`app/acesso.tsx`), rota `POST /api/auth/recuperar`: e-mail + código + senha nova. Mesma mensagem para e-mail inexistente e código errado; usa a mesma trava de tentativas do login; o código vale **uma vez**; desconecta todos os aparelhos e entra.
- **Lembrete na Visão geral** enquanto a pessoa não tem código.
- A tabela `recovery_codes` é criada pelo próprio sistema no primeiro uso (`CREATE TABLE IF NOT EXISTS`, em `lib/recuperacao.ts`): **não precisa rodar SQL no painel** ao publicar.
- Verificado ponta a ponta no sistema de teste: 14 casos, incluindo código digitado em minúsculas e sem traço, código reusado recusado, sessão antiga derrubada.
- **A conferir depois de publicar:** trocar a senha faz dois cálculos de PBKDF2 (conferir a atual e gravar a nova), cerca de 7 ms de CPU. Cabe nos 10 ms do plano grátis, mas com pouca folga; local não mede isso (ver "O limite de CPU do Workers já mordeu").
**Usuários e chave de emergência (30/09/2026).** A cadeia de recuperação, pedida pelo dono: funcionário esqueceu → admin redefine; admin esqueceu → código de recuperação; perdeu o código → chave de emergência pela Cloudflare; perdeu a Cloudflare → recuperação da própria Cloudflare pelo e-mail dele.
- **Tela Usuários** (`app/usuarios.tsx`, no menu **só para admin**; rota `app/api/usuarios/route.ts`, guarda `exigirAdmin`): criar (nome, e-mail, papel admin/equipe), editar nome e papel, **redefinir senha** e **desativar/reativar**. Criar e redefinir geram **senha temporária** (`senhaTemporaria()` em `lib/auth.ts`, formato `K7QM-2WXA-PT9C`, testada contra a própria regra de senha), mostrada uma vez ao admin, com botão de copiar com instruções.
- **Troca obrigatória**: quem entra com senha temporária vê só a tela "Crie a sua senha" (`app/acesso.tsx`); o servidor também barra a gestão (`exigirEquipe` recusa com "Troque sua senha temporária") até trocar.
- **Regras** (no servidor): nunca fica sem admin ativo (não se desativa nem se rebaixa o último); ninguém desativa a si mesmo; redefinir e desativar derrubam as sessões da pessoa; desativado não entra (mensagem só depois da senha certa, para não revelar e-mails) e perde a sessão aberta na hora.
- Situação de cada usuário na tabela `user_status` (ativo, precisa trocar), criada pelo próprio sistema (`garantirTabelaStatus` em `lib/sessao.ts`, uma vez por processo). Sem linha = ativo. **Nada de SQL no painel.**
- **Chave de emergência**: segredo `CHAVE_EMERGENCIA` cadastrado pelo dono no painel da Cloudflare (Workers & Pages → 3d → Settings → Variables and Secrets → Add → Secret). Vale no lugar do código de recuperação, **só para admin**, se tiver ao menos 16 letras/números (comparada sem diferenciar maiúsculas, espaços e traços). A tela Usuários mostra se está cadastrada e o passo a passo; a orientação é criar só na hora do aperto e apagar depois. Uso fica no log (`console.warn`).
- Verificado com 23 casos no sistema de teste (servidor local com `--var CHAVE_EMERGENCIA`): funcionário com senha temporária barrado até trocar; equipe não vê Usuários; redefinir derruba a sessão; desativado não entra; admin não se desativa nem se rebaixa sendo o único; chave não vale para funcionário; chave em minúsculas vale para admin e derruba as sessões antigas.
- Dado de teste que ficou no banco local: usuário "Funcionario Teste" (desativado).

**Ferramentas (EM ANDAMENTO, 30/09/2026).** Aprovado pelo dono: aba "Ferramentas" em Materiais, como inventário do que a empresa tem (paquímetro, maçarico...), entrando sozinha no total de Investimentos na categoria "Ferramentas"; e "Material de consumo" (lâmina, lixa, cola) com estoque, reaproveitando os insumos com `kind: 'consumo'` (fora da Precificação). **Já feito**: ações `tool`/`removeTool` e lista `tools` no servidor; `Insumos` aceita `modo="consumo"`; a Precificação filtra consumo. **Falta**: a tela `app/ferramentas.tsx`, a aba em Materiais, somar `tools` em Investimentos, e mover o "Alicate, espátula e lixas" (dado de teste) de Investimentos para Ferramentas.

**Ainda não existe portal do cliente.** O papel `cliente` existe no banco, mas `exigirEquipe` barra qualquer um que não seja `admin` ou `equipe`. Abrir para cliente depende do banco relacional: com o estado todo num JSON só, não há como mostrar a ele apenas o pedido dele.

## Segurança que este projeto exige de verdade

O cliente acessa o sistema. "Cliente vê apenas os próprios pedidos" não é detalhe de interface — tem que valer no banco, com RLS, não apenas escondendo botões na tela. Um pedido vazado é dado comercial de outro cliente.

## Estado atual do repositório

```
calculadora-3d.html     a calculadora de orçamento, funcionando
precificacao.js         o motor de preço da calculadora, lógica pura
teste-precificacao.js   52 testes do motor, sem dependências
gestao-3d/              o sistema de gestão
  lib/precificacao.ts        o motor de preço (voltou em 29/09)
  lib/precificacao.teste.ts  49 testes do motor
  app/precificacao.tsx       a tela de Precificação refeita
  lib/auth.ts                senha e token de sessão
  lib/auth.teste.ts          37 testes de autenticação
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

**Rodar o Gestão 3D** (dentro de `gestao-3d/`, com Node 22 e pnpm 11) — todos verificados no contêiner e no Windows do dono:

```
pnpm install --frozen-lockfile
pnpm build
npx wrangler d1 execute DB --config dist/server/wrangler.json \
  --local --persist-to .wrangler/state --file drizzle/0000_small_solo.sql
npx wrangler d1 execute DB --config dist/server/wrangler.json \
  --local --persist-to .wrangler/state --file drizzle/0001_login.sql
pnpm start      # sobe em http://127.0.0.1:8787
```

As migrações só são necessárias na primeira vez; sem elas a API responde 503. **São duas**: a segunda cria as tabelas de login. O banco é chamado pelo nome do vínculo, `DB`, e não pelo nome do banco: o nome mudou de `site-creator-d1` para `fabricando3d` quando o projeto foi apontado para a conta real, e o comando antigo parou de funcionar por isso.

**Rodar os testes** (dentro de `gestao-3d/`). Os do motor: `node --experimental-strip-types lib/precificacao.teste.ts` → `49 passaram, 0 falharam`. Os da autenticação:

```
node --experimental-strip-types lib/auth.teste.ts
```

Sai `37 passaram, 0 falharam`. E os de arquivo:

```
node --experimental-strip-types lib/arquivos.teste.ts
```

Sai `35 passaram, 0 falharam`. Com o sistema no ar, `bash scripts/teste-acesso.sh http://127.0.0.1:8787` confere que a API recusa quem não entrou: `9 passaram, 0 falharam`. Todos verificados. **`pnpm test` roda os três conjuntos**, e `pnpm build` chama `pnpm test` antes de construir.

**Dívida pré-existente:** `npx tsc --noEmit` acusa **7 erros de tipo em `lib/domain.ts`**, em `supplierId`, `spoolCount` e `spoolWeight` sobre um tipo união. Vieram assim do construtor do ChatGPT, não foram introduzidos aqui. O build passa mesmo assim porque o Vite remove os tipos sem conferir. Vale pagar essa dívida quando a tela for mexida.

**Investimentos e vencimento das contas a pagar (29/09/2026) — feitos e verificados.** `tsc` só com os 7 erros antigos; `pnpm build` roda 4 conjuntos (49 + 37 + 35 + 23). No navegador, com dados de teste: investido R$ 3.200, pedido de R$ 62,60 com R$ 31,30 de lucro pago pela metade → "já voltou" R$ 15,65 e "0,4%"; contas em ordem de vencimento com "Atrasada há 9 dias", "Vence hoje", "Vence em 2 dias"; quadro "Contas atrasadas" com R$ 450 em vermelho. Percentual pequeno aparece com uma casa decimal, arredondado para baixo, para não mostrar "0%" nem exagerar.

- **Investimentos** (`app/investimentos.tsx`, menu abaixo de Financeiro): data, descrição, categoria (sugestões + livre), valor, forma de pagamento (Pix, cartões, dinheiro, transferência, boleto), banco ou conta, observações. Editar e apagar. Mostra total investido, **quanto já voltou**, quanto falta, barra de progresso e totais por categoria e por banco. Ações do servidor: `investment` (com `id` edita) e `removeInvestment`. Lista nova no estado: `investments`.
- **"Quanto já voltou"** = lucro de cada pedido (soma de `calculate().profit` dos itens, já descontadas as taxas; `orderProfit()` em `lib/domain.ts`) × fração já recebida do cliente. Decisão do dono. Conta pura em `lib/financeiro.ts` (`lucroRecebido`).
- **Contas a pagar**: o vencimento **já existia** (campo `due` das compras). Agora a lista sai em ordem de vencimento, com etiqueta "Atrasada há N dias" (vermelha), "Vence hoje", "Vence amanhã" / "em N dias" (até 3); e um quadro "Contas atrasadas" no topo do Financeiro, vermelho quando há alguma. Tudo manual, sem repetição automática (decisão do dono: são faturas de cartão com valor diferente todo mês).
- `lib/store.ts` agora **completa dados salvos antigos** com o estado vazio ao carregar, para uma lista nova (como `investments`) não quebrar quem já tem dados.

**Insumos (29/09/2026).** Argola de chaveiro, saquinho, caixa, etiqueta, ímã: contados em **unidades**, numa aba "Insumos" em Materiais (a aba de bobinas virou "Filamentos"). Cadastro com tipo (acabamento ou embalagem), unidade, custo por unidade, estoque mínimo e quantidade inicial; entradas e ajustes; últimas movimentações. Tela em `app/insumos.tsx`; estado `supplies` e `supplyMovements`; ações `supply`, `supplyMovement`, `removeSupply`.
- **Na Precificação**, a seção "Insumos da peça" substituiu os campos digitados "Embalagem, por peça" e "Outros acabamentos, por peça" (que continuam no esquema, zerados, e valem em orçamentos antigos; o padrão de embalagem passou de 2 para 0). Escolhe-se o insumo e a quantidade por peça; o **custo por unidade é copiado no momento do cálculo**, então mudar o preço do insumo depois não mexe em orçamento salvo.
- **Na conta**: linha nova "Insumos" = custo por peça × quantidade, **fora da margem de falha** (decisão do dono: argola e saquinho só entram depois da impressão). Motor: campo `insumos` em `lib/precificacao.ts`, com 5 testes novos (54 no total), incluindo o ROI exato com insumos e taxas.
- **Baixa do estoque ao embalar** (decisão do dono): quando o pedido é marcado como embalado na Produção, cada insumo sai do estoque (quantidade por peça × peças). Estoque insuficiente **bloqueia** com mensagem dizendo quanto falta, igual ao filamento. Desmarcar a embalagem é recusado, para não descontar duas vezes. Verificado: pedido de 10 chaveiros baixou 100→90 argolas e 50→40 saquinhos.

**Parcelas nos investimentos (29/09/2026).** Pedido do dono: ao clicar num investimento, ver se foi pago e, se parcelado, quantas parcelas já foram pagas. Decisões dele: **cada parcela é marcada como paga à mão** (botão "Marcar como paga"), com **lembrete na tela** quando uma parcela vence sem ser marcada ("Já paguei" resolve); e as parcelas **não** vão para Contas a pagar, porque a fatura do cartão já é lançada lá e contaria em dobro. Campos novos do investimento: `parcelado`, `installments`, `firstDue` (vencimento da 1ª) e `paidParcels` (números das parcelas pagas); ação `investmentParcel` marca/desmarca uma. Editar mantém as parcelas já marcadas que ainda existirem. À vista conta como pago. Datas das parcelas: mesmo dia de cada mês, e dia 31 cai no último dia dos meses curtos. Valores: centavos exatos, a última parcela leva a sobra. Contas em `lib/financeiro.ts` (`resumoParcelas`), 43 testes no total do arquivo. A tela ganhou o quadro "Ainda a pagar (parcelas)", o detalhe ao clicar, e o filtro ao clicar num banco. **Investimentos cadastrados antes disso aparecem como "Pago à vista"**: para virarem parceladas, é preciso editar.

**Campo de dinheiro com máscara brasileira (29/09/2026).** Pedido do dono: o campo mostrava "524220" cru. Agora todo campo de dinheiro do sistema usa `InputDinheiro` (`app/campo-dinheiro.tsx`): os números entram pelos centavos, como no app do banco, e o campo mostra "R$ 5.242,20" enquanto se digita. Regra em `lib/dinheiro.ts`, com 25 testes. O `MoneyInput` do `manager.tsx` passou a usá-lo, então valem os cadastros, Financeiro e Configurações; a tarifa de energia (rótulo com "kWh") aceita **três casas** (R$ 0,857), como vem na conta de luz. Verificado digitando tecla por tecla: 524220 → R$ 5.242,20; apagar → R$ 524,22.

**O que ainda não existe:** o site público (vitrine), o portal do cliente e o banco relacional. A calculadora (`calculadora-3d.html`) segue como peça avulsa, mas o motor de preço dela já é o que vale dentro do Gestão 3D.

## No computador do dono (Windows)

Desde 28/09/2026 o trabalho acontece no computador do dono, em `C:\ProjetosDev\3D\Fabricando3D`, pelo aplicativo Claude para Windows, e não mais na nuvem.

- A pasta veio de um ZIP do GitHub e foi ligada ao repositório depois (`git init` + `origin` = `github.com/raimaciel/3D`). Estava idêntica ao commit `c50be42`.
- **Node 26 e pnpm 10 servem.** O pnpm 10 baixa sozinho o pnpm 11.25 que o `package.json` pede. Tudo passa com eles: os quatro conjuntos de testes, o build e o servidor local.
- **Defeito do wrangler no Windows:** um POST com corpo que o sistema recusa **sem ler** o corpo recebe, uma vez sim e outra não, 503 *"Your worker restarted mid-request"*. A mensagem vem da camada que só existe no servidor local, e acontece igual com Node 22. Medido: 6 de 12 nesses casos; 0 de 12 em POST sem corpo ou com corpo lido. Não "conserte" isso fazendo o sistema ler o corpo de quem não entrou: seria piorar o código que vai ao ar por causa de uma ferramenta local. `scripts/teste-acesso.sh` repete a requisição só quando vê essa mensagem exata.
- `.claude/launch.json` sobe o servidor local pelo painel de navegador do aplicativo.
- O Git para Windows vem com `core.autocrlf = true` e converteria os `.sh` para CRLF ao baixar, o que quebra o bash. O `.gitattributes` da raiz fixa os `.sh` em LF.
- **Para enviar ao GitHub** (e assim publicar), o dono precisa entrar na conta do GitHub neste computador na primeira vez que for enviar. O `gh` não está logado.

## Publicação (no ar)

`gestao-3d/PUBLICAR.md` é o passo a passo para o dono, com os dois caminhos: pelo painel da Cloudflare, sem terminal, ou pelo terminal com `scripts/publicar.sh`.

O que mudou no projeto para isso ser possível: o `vite.config.ts` apontava para a conta da OpenAI, com nome de banco e bucket fixos e um `database_id` de exemplo. Agora ele lê `CF_WORKER_NAME`, `CF_D1_NOME`, `CF_D1_ID` e `CF_R2_BUCKET` do ambiente, caindo nos valores antigos quando não há `.env` — assim o desenvolvimento local segue funcionando sem configuração.

**Verificado:** o build gera a configuração certa com e sem `.env`, e `wrangler deploy --dry-run` valida o Worker com os bindings `DB` e `BUCKET` apontando para os nomes da Fabricando 3D. O pacote dá 318 KB comprimido.

**No ar, verificado em 28/09/2026:** `https://3d.ranbm3.workers.dev` responde, e `scripts/teste-acesso.sh` contra ele dá `9 passaram, 0 falharam`: a API recusa quem não entrou. `/api/auth/me` devolve `precisaConfigurar: false`, ou seja, **o primeiro acesso já foi criado** — pelo próprio dono, numa sessão anterior do Claude (confirmado por ele). A publicação é feita pela integração da Cloudflare com o GitHub (Workers Builds, Root directory `gestao-3d`) a cada envio para a `main`.

**Os testes rodam dentro de `pnpm build`** (decisão do dono, 28/09/2026). O script `build` do `package.json` chama `pnpm test` antes de construir, então o Workers Builds, que é quem publica de fato, **não publica se um teste falhar**. Verificado: com um teste quebrado de propósito, a construção para com erro. Antes disso o Workers Builds não rodava teste nenhum.

**Pendente, esperando o dono autorizar:** apagar `.github/workflows/publicar.yml`. Ele falhou nas seis execuções que teve, na etapa `pnpm/action-setup` (*"No pnpm version is specified"*: procura o `package.json` na raiz, e o projeto está em `gestao-3d/`). O dono escolheu ficar só com o caminho da Cloudflare, mas a remoção foi barrada pelo controle de permissões desta sessão e precisa de autorização explícita dele. Enquanto ficar, ele só gera um "falhou" no GitHub a cada envio, sem efeito no site.

**Armadilha no Windows:** `pnpm build` falha com `EPERM ... dist` se o servidor local (`pnpm start`) estiver rodando, porque ele segura os arquivos da pasta `dist`. Desligue o servidor antes de construir.

**Falta:** o domínio. `fabricando3d.com.br` não tem endereço no DNS (em 28/09/2026 o `nslookup` não devolve nenhum IP).

**Recursos reais da conta, criados em 26/09/2026 e já gravados no `vite.config.ts`:** Worker `3d`, banco D1 `fabricando3d` (id `50c8c520-3ebe-447f-8502-10429660a661`) e bucket R2 `fabricando3d-arquivos`. O id do banco não é segredo — é só um identificador, e ninguém alcança o banco sem estar autenticado na conta. Deixá-lo no repositório poupa o dono de configurar variável de build no painel. O `.env` sobrepõe, para publicar noutro lugar.

Três armadilhas encontradas ao preparar, que valem lembrar:

- **O console do D1 no painel é um campo de UMA LINHA.** Colar um `.sql` com quebras de linha e comentários faz tudo virar uma linha, e o `--` do primeiro comentário comenta o arquivo inteiro: o console responde *"The request is malformed: Requests without any query are not supported"*. Foi o que aconteceu com o dono. Por isso existe `drizzle/COLAR-NO-CONSOLE-D1.sql`, gerado sem comentário e numa linha só, testado exatamente nesse formato.

- **`wrangler whoami` sai com código 0 mesmo sem login** — ele só avisa no texto. Checar o código de saída não detecta nada; o script olha a saída.
- **`.gitignore` não aceita comentário no fim da linha.** `!.env.exemplo  # nota` vira um padrão literal e a exceção não funciona. O comentário tem que ficar em linha própria.

**Exigência da Cloudflare que trava o setup:** o R2 só é habilitado com cartão cadastrado, mesmo no plano grátis. Dá para publicar sem R2 (login e orçamento funcionam; envio de arquivo e foto não) se o dono preferir adiar isso.

## Git

- Branch padrão: `main`.
- Sessões do Claude Code desenvolvem em branches `claude/*`, sem commitar direto na `main`.
