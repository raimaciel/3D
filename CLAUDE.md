# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este arquivo está em português porque boa parte dele são fatos sobre o negócio que o dono do projeto precisa poder conferir e corrigir.

## O negócio

**Fabricando 3D** é uma empresa de impressão 3D: imprime e modela peças para clientes. O domínio **fabricando3d.com.br** já está registrado e é onde o projeto vai no ar.

O nome do repositório é `3D`, mas isto **não é um projeto de 3D gráfico**. Nenhuma biblioteca de renderização (Three.js, React Three Fiber, Babylon.js) tem papel aqui. O "3D" é o ramo da empresa. Não confunda: essa confusão já aconteceu uma vez nesta sessão.

## O que vamos construir

Um **sistema de gestão** para a empresa, junto com o site público, em **um único projeto com área de login**:

- **Parte pública** — vitrine das peças impressas e porta de entrada para pedidos. Precisa ser encontrável no Google, então o conteúdo público tem que ser renderizado no servidor.
- **Área interna (equipe)** — a gestão do dia a dia.
- **Área do cliente** — o cliente acompanha o próprio pedido.

Módulos da gestão, todos confirmados pelo dono:

1. **Orçamentos e pedidos** — cliente pede uma peça, o sistema calcula o preço, envia o orçamento e acompanha o pedido até a entrega.
2. **Clientes e histórico** — cadastro com contato e tudo que cada cliente já encomendou.
3. **Estoque de filamento** — quanto material existe de cada cor e tipo, quanto cada peça consumiu, aviso quando estiver acabando.
4. **Fila das impressoras** — quais impressoras estão livres ou ocupadas, o que está imprimindo, quanto tempo falta.

Precisa funcionar **online, no celular e no PC** — o dono vai consultar pelo celular dentro da oficina, então as telas se desenham pensando em tela pequena primeiro.

## Quem mantém este código

O dono do projeto é **iniciante em programação**. Isso não é um detalhe, é uma restrição de projeto:

- Explique o que está fazendo e por quê, em português, sem jargão não explicado.
- Cuide você da configuração de ambiente, instalação e deploy; não entregue um passo manual que dependa de conhecimento que ele não tem.
- Prefira código claro e óbvio a código curto e esperto. Quem vai voltar neste arquivo em três meses está aprendendo.
- Menos peças móveis vence flexibilidade. Cada serviço, biblioteca ou ferramenta a mais é mais uma coisa que ele vai ter que entender sozinho quando quebrar.

## Stack recomendada (decidida por delegação, ainda não implementada)

O dono delegou a escolha técnica. A recomendação registrada é:

- **Next.js + TypeScript** — atende site público e área logada no mesmo projeto e no mesmo deploy, que é exatamente o formato pedido. O TypeScript entra justamente porque o dono é iniciante: erros aparecem na hora de escrever, não com o cliente na frente.
- **Supabase** — banco Postgres e autenticação prontos, sem precisar escrever e hospedar um servidor próprio. O controle de acesso por linha (RLS) resolve diretamente a exigência de "cliente vê só o pedido dele".
- **Vercel** — publica Next.js com domínio próprio no plano grátis, o que serve para o tamanho deste projeto.
- **Tailwind CSS** — layout que funciona no celular sem virar um arquivo de estilo difícil de manter.

Nada disso está instalado ainda. Ao implementar, confirme a escolha com o dono antes de criar os arquivos: a decisão é reversível hoje e caríssima depois de meses de código.

**Ressalva honesta a manter na mesa:** mesmo essa stack tem curva de aprendizado real para quem está começando. Uma planilha ou um banco no Notion resolveriam a gestão nesta semana. O caminho em código foi escolhido porque o dono quer o sistema **como portfólio** além de ferramenta — se em algum momento a prioridade virar "preciso disso funcionando agora", essa troca precisa ser oferecida de novo, não escondida.

## O que ainda não se sabe — não invente

**A fórmula de preço é o coração do negócio e ela não foi definida.** Orçamento de impressão 3D costuma combinar peso do filamento, tempo de impressão, custo de energia, desgaste da máquina, trabalho de modelagem e margem. Os números e os pesos disso são do dono e variam por empresa. Pergunte antes de implementar cálculo de preço; não chute uma fórmula plausível.

Também em aberto: quantas impressoras existem e quais modelos, quais materiais e cores são usados, e se o cliente vai enviar arquivo próprio (STL/3MF) ou encomendar modelagem.

## Segurança que este projeto exige de verdade

O cliente acessa o sistema. Então "cliente vê apenas os próprios pedidos" não é um detalhe de interface — tem que ser garantido no banco, com RLS, não apenas escondendo botões na tela. Um pedido vazado é dado comercial de outro cliente.

## Estado atual do repositório

Só existem `README.md` (conteúdo: o título) e este arquivo. **Nenhuma linha de código, nenhuma dependência, nenhum banco, nenhum teste, nenhum deploy.** Tudo acima é decisão e contexto, não código existente.

Quando o primeiro código entrar, substitua esta seção pelos comandos reais de rodar, testar e publicar — cada um verificado rodando de fato antes de ser escrito aqui — e por uma descrição da arquitetura que de fato existir.

## Git

- Branch padrão: `main`.
- Sessões do Claude Code desenvolvem em branches `claude/*`, sem commitar direto na `main`.
