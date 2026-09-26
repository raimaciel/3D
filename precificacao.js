/*
 * Motor de precificação da Fabricando 3D.
 *
 * Regra de negócio central do projeto. Não tem nada de tela aqui: entra um
 * objeto com números, sai um objeto com números. Isso é de propósito — é o que
 * permite testar o cálculo sem abrir navegador (veja teste-precificacao.js).
 *
 * Funciona tanto como <script> no navegador quanto via require() no Node.
 */
function calcularPrecificacao(e) {
  const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };

  const qtd = e.lote ? Math.max(1, Math.round(n(e.qtd) || 1)) : 1;
  const horas = n(e.horas) + n(e.minutos) / 60;

  // Estes três se referem ao LOTE INTEIRO: o fatiador informa peso e tempo da
  // mesa cheia, não de uma peça. A divisão por quantidade acontece no fim.
  const filamento = n(e.peso) / 1000 * n(e.precoKg);
  const energia = n(e.potencia) / 1000 * horas * n(e.kwh);
  const maquina = n(e.vidaMaq) > 0 ? n(e.valorMaq) / n(e.vidaMaq) * horas : 0;

  // Trabalho humano, com três escopos diferentes — é aqui que estava o defeito
  // antigo, que tratava acabamento como se fosse uma vez só no lote.
  const acabamento = n(e.acabaMin) * qtd / 60 * n(e.maoHora); // por peça
  const preparo = n(e.preparoMin) / 60 * n(e.maoHora);        // uma vez no trabalho
  const modelagem = n(e.modelaHoras) * n(e.modelaHora);       // uma vez no pedido

  const extras = n(e.extras) * qtd; // embalagem: por peça

  // Margem de falha: cobre o que se perde de fato quando a impressão falha.
  // Inclui preparo e acabamento, porque o trabalho é refeito.
  // Exclui modelagem, porque o arquivo CAD continua valendo.
  // Exclui embalagem, porque a peça perdida nunca chegou a ser embalada.
  const falhas = (filamento + energia + maquina + acabamento + preparo) * n(e.falha) / 100;

  const itens = {
    Filamento: filamento,
    Energia: energia,
    'Máquina': maquina,
    Modelagem: modelagem,
    Preparo: preparo,
    Acabamento: acabamento,
    Extras: extras,
    Falhas: falhas
  };

  const custoTotal = Object.values(itens).reduce((a, b) => a + b, 0);
  const custoPeca = custoTotal / qtd;

  const imposto = n(e.imposto) / 100;
  const marketplace = n(e.taxa) / 100;
  const anuncios = n(e.roas) > 0 ? 1 / n(e.roas) : 0;
  const percTaxas = imposto + marketplace + anuncios;
  const roi = n(e.roi) / 100;

  // O campo é "taxa fixa por VENDA". Um lote vendido de uma vez é uma venda,
  // então a taxa é rateada entre as peças em vez de cobrada em cada uma.
  const fixaPorPeca = n(e.taxaFixa) / qtd;

  // Sem margem possível: as taxas praticamente consomem o preço inteiro.
  const bloqueado = percTaxas >= 0.95;

  // Preço que, depois de pagar imposto, marketplace, anúncios e taxa, ainda
  // deixa exatamente o ROI pedido sobre o custo. A margem incide POR FORA das
  // taxas — este é o acerto principal da fórmula original e foi preservado.
  const preco = bloqueado ? 0 : (custoPeca * (1 + roi) + fixaPorPeca) / (1 - percTaxas);

  const descontos = {
    Imposto: preco * imposto,
    Marketplace: preco * marketplace,
    'Taxa fixa': bloqueado ? 0 : fixaPorPeca,
    'Anúncios': preco * anuncios
  };
  const totalDescontos = Object.values(descontos).reduce((a, b) => a + b, 0);
  const lucroPeca = preco - custoPeca - totalDescontos;

  return {
    qtd, horas, itens, custoTotal, custoPeca,
    preco, descontos, totalDescontos, lucroPeca,
    roiReal: custoPeca > 0 ? lucroPeca / custoPeca * 100 : 0,
    bloqueado, percTaxas
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularPrecificacao };
}
