# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este arquivo está em português porque boa parte dele são fatos sobre o negócio que o dono do projeto precisa poder conferir e corrigir.

## O negócio

**Fabricando 3D** é uma empresa de impressão 3D: imprime e modela peças para clientes. O domínio **fabricando3d.com.br** já está registrado e é onde o projeto vai no ar.

O nome do repositório é `3D`, mas isto **não é um projeto de 3D gráfico**. Nenhuma biblioteca de renderização (Three.js, React Three Fiber, Babylon.js) tem papel aqui. O "3D" é o ramo da empresa. Não confunda: essa confusão já aconteceu uma vez nesta sessão.

A empresa **está começando e ainda não tem clientes**. O sistema nasce vazio: não há histórico nem planilha de clientes para importar.

## Ponto de partida: a calculadora (JÁ NO REPOSITÓRIO)

`calculadora-3d.html` é a calculadora de orçamento que o dono construiu antes deste projeto, trazida para cá **byte a byte, sem alteração**. Ela é o ponto de partida do sistema: o pedido dele é evoluí-la, não recomeçar.

**O que ela é tecnicamente:** um único arquivo HTML com CSS e JavaScript embutidos, sem framework, sem build, sem dependência externa além das fontes do Google. Estado salvo em `localStorage` (três chaves: `calc3d`, `calc3d-empresa`, `calc3d-tema`). Gera PDF e PNG desenhando num `canvas` e montando os bytes do PDF à mão, sem biblioteca.

**Ela foi feita como Artifact do Claude** e depende de `window.claude.use('downloads')` para salvar arquivo, com fallback para download do navegador. Essa dependência **tem que sair** quando virar sistema — fora do app do Claude ela não existe.

### A fórmula de preço (regra de negócio central — não altere sem o dono)

Custos, por impressão:

| Item | Cálculo |
|---|---|
| Filamento | `peso(g) / 1000 × preço do rolo (R$/kg)` |
| Energia | `potência(W) / 1000 × horas × tarifa (R$/kWh)` |
| Máquina | `valor da impressora / vida útil(h) × horas` |
| Mão de obra | `minutos / 60 × valor da hora` |
| Extras | `embalagem e extras × quantidade` |
| Falhas | `(Filamento + Energia + Máquina) × margem de falha %` |

`custo da peça = (soma de todos os itens) / quantidade`

Preço de venda:

```
preço = (custo × (1 + ROI)) + taxa fixa
        ---------------------------------
        1 − imposto% − marketplace% − (1 / ROAS)
```

Com trava: se `imposto + marketplace + 1/ROAS >= 95%`, o preço é bloqueado e um erro aparece, porque não sobraria margem.

**Essa fórmula está matematicamente correta e foi verificada numericamente**: o lucro dividido pelo custo devolve exatamente o ROI pedido, inclusive com imposto, marketplace, ROAS e taxa fixa atuando juntos. É o acerto mais importante dela — a margem é aplicada *por fora* das taxas, não por dentro. **Preserve esse comportamento em qualquer reescrita** e teste contra estes valores antes de considerar a migração correta.

Dados de referência embutidos no arquivo, que valem migrar: tarifa média de energia dos 27 estados e consumo em watts de 30 modelos de impressora por marca (a **Bambu Lab A1**, a máquina da casa, está lá com 150 W).

### Defeitos conhecidos, confirmados por teste, ainda NÃO corrigidos

Os dois aparecem apenas no **modo lote** e ambos mexem em dinheiro. Estão pendentes de decisão do dono; não corrija por conta própria.

1. **Mão de obra é subestimada no lote.** O campo diz "Seu tempo **na peça**" e a dica fala de remoção de suporte e lixa — trabalho por peça. Mas o código não multiplica pela quantidade, e depois divide o total pela quantidade. Num lote de 20 peças com 10 min de acabamento cada, ela cobra R$ 0,42 por peça em vez de R$ 8,33: **20× menos**. O campo `Extras`, ao lado, *é* multiplicado pela quantidade — ou seja, dois campos vizinhos com a mesma leitura têm tratamento oposto.
2. **Taxa fixa é cobrada por peça no lote.** O campo é "Taxa fixa por **venda**", mas entra no preço de cada peça. Num lote de 20 com taxa de R$ 6,00, cobra R$ 120,00 onde deveria cobrar R$ 6,00.

Os dois erram em direções opostas, o que é justamente o que os torna difíceis de notar: o preço do lote pode parecer plausível com os dois errados.

### Lacuna em relação ao negócio

A calculadora tem uma única linha de trabalho humano ("seu tempo na peça", em minutos), pensada em acabamento. Mas a empresa também **vende modelagem sob encomenda**, que é trabalho de CAD medido em horas e cobrado a outra taxa. Hoje não há linha separada para isso. Falta definir com o dono.

### Identidade visual já estabelecida

A calculadora já define a marca, e o sistema deve seguir: azul-marinho `#132840`, turquesa `#1CB8C4`, fundo claro `#EEF2F6`, fontes **Sora** (títulos e números) e **Figtree** (texto). Tem tema claro e escuro funcionando e layout que já responde bem no celular.

### Caminho de migração recomendado

O motor de preço é lógica pura em cerca de 50 linhas e só toca o DOM através de uma função `num()`. Ele sai limpo:

1. Extrair para uma função pura em TypeScript, com os custos e o preço entrando e saindo como dados.
2. Cobrir com teste comparando contra os números da calculadora atual, provando que nada mudou.
3. Só então construir os cadastros em volta.

Nessa ordem. Reescrever a fórmula junto com a construção do sistema é a forma mais fácil de quebrar o preço sem ninguém perceber.

## O que vamos construir

Um **sistema de gestão** junto com o site público, em **um único projeto com área de login**:

- **Parte pública** — vitrine das peças e porta de entrada para pedidos. Precisa ser encontrável no Google, então o conteúdo público tem que ser renderizado no servidor.
- **Área interna (equipe)** — a gestão do dia a dia.
- **Área do cliente** — o cliente acompanha o próprio pedido.

Módulos confirmados pelo dono:

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

## Stack recomendada (decidida por delegação, ainda não implementada)

O dono delegou a escolha técnica. A recomendação registrada:

- **Next.js + TypeScript** — atende site público e área logada no mesmo projeto e no mesmo deploy, que é o formato pedido. TypeScript entra justamente porque o dono é iniciante: o erro aparece na hora de escrever, não com cliente na frente.
- **Supabase** — Postgres e autenticação prontos, sem servidor próprio para manter. O controle de acesso por linha (RLS) resolve diretamente "cliente vê só o pedido dele".
- **Vercel** — publica Next.js com domínio próprio no plano grátis, suficiente para este tamanho.
- **Tailwind CSS** — layout que funciona no celular sem virar CSS impossível de manter.

Nada está instalado. A calculadora já foi vista: é HTML puro, sem build. Isso **não invalida** a escolha acima — o sistema precisa de banco, login e acesso multiusuário, que uma página solta não sustenta. Mas significa que a migração é incremental e que o CSS e a identidade visual existentes se aproveitam quase inteiros.

**Ressalva honesta a manter na mesa:** essa stack tem curva de aprendizado real para quem começa. O caminho em código foi escolhido porque o dono quer o sistema também como portfólio. Se em algum momento a prioridade virar "preciso disso funcionando agora", a troca por uma solução mais simples precisa ser oferecida de novo, não escondida.

## O que ainda não se sabe — não invente

- **Semântica do modo lote**: os dois defeitos acima dependem de saber se "tempo na peça" e "taxa fixa" são por peça ou por lote. Pergunte antes de corrigir; um palpite aqui erra preço de venda real.
- **Modelagem sob encomenda**: precisa de linha própria com valor de hora separado? Não definido.
- **Margem de falha**: hoje incide só sobre filamento, energia e máquina, deixando mão de obra e embalagem de fora. Pode ser intencional. Confirmar.
- **Fornecedores**: não se sabe se basta cadastro de contato ou se ele quer preço por fornecedor e histórico de compra.
- **Volume esperado de pedidos**: não perguntado. Muda o quanto de automação se justifica.

## Segurança que este projeto exige de verdade

O cliente acessa o sistema. "Cliente vê apenas os próprios pedidos" não é detalhe de interface — tem que valer no banco, com RLS, não apenas escondendo botões na tela. Um pedido vazado é dado comercial de outro cliente.

## Estado atual do repositório

Três arquivos: `README.md` (só o título), este arquivo e **`calculadora-3d.html`**, que funciona hoje — abre direto no navegador, sem instalar nada.

Ainda **não existe** sistema: nenhum framework, nenhuma dependência, nenhum banco, nenhuma autenticação, nenhum teste, nenhum deploy. Cadastro de clientes, fornecedores, usuários, estoque e fila de impressoras: nada disso foi construído.

Quando o sistema começar, substitua esta seção pelos comandos reais de rodar, testar e publicar — cada um verificado rodando de fato — e pela arquitetura que existir.

## Git

- Branch padrão: `main`.
- Sessões do Claude Code desenvolvem em branches `claude/*`, sem commitar direto na `main`.
