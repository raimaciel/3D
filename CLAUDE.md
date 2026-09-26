# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este arquivo está em português porque boa parte dele são fatos sobre o negócio que o dono do projeto precisa poder conferir e corrigir.

## O negócio

**Fabricando 3D** é uma empresa de impressão 3D: imprime e modela peças para clientes. O domínio **fabricando3d.com.br** já está registrado e é onde o projeto vai no ar.

O nome do repositório é `3D`, mas isto **não é um projeto de 3D gráfico**. Nenhuma biblioteca de renderização (Three.js, React Three Fiber, Babylon.js) tem papel aqui. O "3D" é o ramo da empresa. Não confunda: essa confusão já aconteceu uma vez nesta sessão.

A empresa **está começando e ainda não tem clientes**. O sistema nasce vazio: não há histórico nem planilha de clientes para importar.

## Ponto de partida: a calculadora já existe

O dono **já construiu uma calculadora de orçamento** e quer transformá-la no sistema, não recomeçar. Esse arquivo ainda **não está neste repositório** — trazê-lo para cá é o primeiro passo técnico.

Isso importa por dois motivos:

1. **A fórmula de preço está nela.** É a regra de negócio mais importante do projeto. Leia a calculadora antes de escrever qualquer cálculo de orçamento e preserve a lógica que já existe; não substitua por uma fórmula própria.
2. **O formato dela decide parte da stack.** Uma planilha, uma página HTML e um script Python levam a caminhos de migração diferentes.

O que o dono pediu para somar à calculadora, nas palavras dele: cadastro de **fornecedores**, **clientes** e **usuários**.

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

Nada está instalado. **Confirme esta escolha depois de ver a calculadora existente**: se ela já for, por exemplo, uma página HTML funcionando, o caminho de migração pesa na decisão.

**Ressalva honesta a manter na mesa:** essa stack tem curva de aprendizado real para quem começa. O caminho em código foi escolhido porque o dono quer o sistema também como portfólio. Se em algum momento a prioridade virar "preciso disso funcionando agora", a troca por uma solução mais simples precisa ser oferecida de novo, não escondida.

## O que ainda não se sabe — não invente

- **A fórmula de preço**: está na calculadora do dono. Leia de lá. Se faltar peça (energia, desgaste de máquina, margem, hora de modelagem), pergunte; não chute.
- **Fornecedores**: ainda não se sabe se basta cadastro de contato ou se ele quer também preço por fornecedor e histórico de compra.
- **Volume esperado de pedidos**: não perguntado ainda. Muda o quanto de automação se justifica.

## Segurança que este projeto exige de verdade

O cliente acessa o sistema. "Cliente vê apenas os próprios pedidos" não é detalhe de interface — tem que valer no banco, com RLS, não apenas escondendo botões na tela. Um pedido vazado é dado comercial de outro cliente.

## Estado atual do repositório

Só existem `README.md` (conteúdo: o título) e este arquivo. **Nenhuma linha de código, nenhuma dependência, nenhum banco, nenhum teste, nenhum deploy.** Tudo acima é decisão e contexto, não código existente. A calculadora citada existe, mas fora daqui.

Quando o primeiro código entrar, substitua esta seção pelos comandos reais de rodar, testar e publicar — cada um verificado rodando de fato — e pela arquitetura que existir.

## Git

- Branch padrão: `main`.
- Sessões do Claude Code desenvolvem em branches `claude/*`, sem commitar direto na `main`.
