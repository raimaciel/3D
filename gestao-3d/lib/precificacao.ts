/*
 * Motor de precificação unificado da Fabricando 3D.
 *
 * Junta as duas peças que o projeto tinha separadas:
 *   - o método da calculadora: o preço é CALCULADO a partir do ROI desejado,
 *     sobrevivendo a imposto, marketplace, anúncios e taxa fixa;
 *   - as linhas de custo do Gestão 3D que a calculadora não tinha:
 *     manutenção, pintura e personalização com escopo.
 *
 * Nada de tela aqui: entram números, saem números. É o que permite testar o
 * cálculo sem navegador (lib/precificacao.teste.ts).
 *
 * UNIDADES — atenção, foi aqui que os dois sistemas divergiam:
 *   power    em WATTS (a etiqueta da impressora; a A1 fica perto de 150 W)
 *   weight   em GRAMAS, do LOTE inteiro, como o fatiador informa
 *   hours    do LOTE inteiro, também como o fatiador informa
 * O Gestão 3D antigo usava kW aqui. Valor salvo no formato antigo precisa ser
 * multiplicado por 1000 antes de entrar, ou a conta erra nessa proporção.
 */

export type EscopoTrabalho = 'pedido' | 'peca';

export type EntradaPreco = {
  quantidade: number;
  lote: boolean;

  // Impressão — valores do lote inteiro, como o fatiador mostra
  peso: number;          // g
  horas: number;
  precoKg: number;       // R$/kg

  // Energia
  potencia: number;      // W
  tarifaKwh: number;     // R$/kWh

  // Máquina: a taxa por hora manda; sem ela, deriva de valor ÷ vida útil
  taxaMaquina?: number;  // R$/h
  valorMaquina?: number; // R$
  vidaMaquina?: number;  // h

  // Manutenção: % sobre material + energia
  manutencao: number;    // %

  // Pintura e acabamento material
  pintura: boolean;
  taxaPintura: number;   // R$ por 100 g
  acabamentoFixo: number;// R$ por peça

  // Trabalho humano
  modelagemHoras: number;    // CAD, uma vez no pedido
  modelagemHora: number;     // R$/h
  personalizacaoMin: number; // gravar nome, variar cor
  personalizacaoHora: number;// R$/h
  personalizacaoEscopo: EscopoTrabalho;
  acabamentoMin: number;     // por peça
  preparoMin: number;        // uma vez no trabalho
  maoHora: number;           // R$/h

  embalagem: number;     // R$ por peça
  falha: number;         // %

  // Custo fixo do mês (DAS do MEI, internet, assinaturas, aluguel): existe
  // mesmo sem imprimir, então cada peça feita no mês paga a sua parte.
  custoFixoMes: number;  // R$ por mês
  pecasMes: number;      // peças feitas por mês

  // Venda
  imposto: number;       // %
  marketplace: number;   // %
  taxaFixa: number;      // R$ por venda
  roas: number;          // x
  roi: number;           // %
};

export type SaidaPreco = {
  quantidade: number;
  itens: Record<string, number>;
  custoTotal: number;
  custoPeca: number;
  preco: number;
  descontos: Record<string, number>;
  totalDescontos: number;
  lucroPeca: number;
  roiReal: number;
  bloqueado: boolean;
  percTaxas: number;
  /** Abaixo deste preço por peça, a venda dá prejuízo (ROI zero). */
  precoMinimo: number;
  /** Lucro do trabalho inteiro dividido pelas horas de impressora que ele ocupa. */
  lucroPorHora: number;
};

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const entradaVazia = (): EntradaPreco => ({
  quantidade: 1, lote: false, peso: 0, horas: 0, precoKg: 0,
  potencia: 0, tarifaKwh: 0, manutencao: 0,
  pintura: false, taxaPintura: 0, acabamentoFixo: 0,
  modelagemHoras: 0, modelagemHora: 0,
  personalizacaoMin: 0, personalizacaoHora: 0, personalizacaoEscopo: 'pedido',
  acabamentoMin: 0, preparoMin: 0, maoHora: 0,
  embalagem: 0, falha: 0, custoFixoMes: 0, pecasMes: 0,
  imposto: 0, marketplace: 0, taxaFixa: 0, roas: 0, roi: 0
});

/** Taxa horária da máquina: a informada, ou derivada de valor ÷ vida útil. */
export function taxaHoraMaquina(e: Partial<EntradaPreco>): number {
  if (n(e.taxaMaquina) > 0) return n(e.taxaMaquina);
  const vida = n(e.vidaMaquina);
  return vida > 0 ? n(e.valorMaquina) / vida : 0;
}

export function calcularPreco(entrada: Partial<EntradaPreco>): SaidaPreco {
  const e = { ...entradaVazia(), ...entrada };
  const qtd = e.lote ? Math.max(1, Math.round(n(e.quantidade) || 1)) : 1;

  // Do lote inteiro
  const filamento = n(e.peso) / 1000 * n(e.precoKg);
  const energia = n(e.potencia) / 1000 * n(e.horas) * n(e.tarifaKwh);
  const maquina = taxaHoraMaquina(e) * n(e.horas);
  const manutencao = (filamento + energia) * n(e.manutencao) / 100;

  // Por peça
  const pintura = (e.pintura ? n(e.peso) / 100 * n(e.taxaPintura) : 0)
                + n(e.acabamentoFixo) * qtd;
  const acabamento = n(e.acabamentoMin) * qtd / 60 * n(e.maoHora);
  const embalagem = n(e.embalagem) * qtd;
  const custoFixo = n(e.pecasMes) > 0 ? n(e.custoFixoMes) / n(e.pecasMes) * qtd : 0;

  // Uma vez no trabalho / no pedido
  const preparo = n(e.preparoMin) / 60 * n(e.maoHora);
  const modelagem = n(e.modelagemHoras) * n(e.modelagemHora);
  const personalizacao = n(e.personalizacaoMin) / 60 * n(e.personalizacaoHora)
                       * (e.personalizacaoEscopo === 'peca' ? qtd : 1);

  // Margem de falha: o que se perde de fato quando a impressão falha.
  // Inclui preparo e acabamento, porque o trabalho é refeito.
  // Exclui modelagem, porque o arquivo CAD continua valendo.
  // Exclui embalagem, porque a peça perdida nunca chegou a ser embalada.
  // Exclui custo fixo, porque a conta do mês não cresce quando uma peça falha.
  const falhas = (filamento + energia + maquina + manutencao + pintura
                  + preparo + acabamento) * n(e.falha) / 100;

  const itens: Record<string, number> = {
    Filamento: filamento, Energia: energia, 'Máquina': maquina,
    'Manutenção': manutencao, Pintura: pintura, Modelagem: modelagem,
    'Personalização': personalizacao, Preparo: preparo,
    Acabamento: acabamento, Embalagem: embalagem, 'Custo fixo': custoFixo,
    Falhas: falhas
  };

  const custoTotal = Object.values(itens).reduce((a, b) => a + b, 0);
  const custoPeca = custoTotal / qtd;

  const imposto = n(e.imposto) / 100;
  const marketplace = n(e.marketplace) / 100;
  const anuncios = n(e.roas) > 0 ? 1 / n(e.roas) : 0;
  const percTaxas = imposto + marketplace + anuncios;
  const roi = n(e.roi) / 100;

  // Taxa fixa é por VENDA: rateada entre as peças do pedido.
  const fixaPorPeca = n(e.taxaFixa) / qtd;

  const bloqueado = percTaxas >= 0.95;

  // O preço que, depois de pagar tudo, ainda deixa exatamente o ROI pedido
  // sobre o custo. A margem incide POR FORA das taxas.
  const preco = bloqueado ? 0 : (custoPeca * (1 + roi) + fixaPorPeca) / (1 - percTaxas);

  const descontos: Record<string, number> = {
    Imposto: preco * imposto,
    Marketplace: preco * marketplace,
    'Taxa fixa': bloqueado ? 0 : fixaPorPeca,
    'Anúncios': preco * anuncios
  };
  const totalDescontos = Object.values(descontos).reduce((a, b) => a + b, 0);
  const lucroPeca = preco - custoPeca - totalDescontos;

  // Preço de ROI zero: paga o custo, as taxas e a taxa fixa, e não sobra nada.
  const precoMinimo = bloqueado ? 0 : (custoPeca + fixaPorPeca) / (1 - percTaxas);
  const horas = n(e.horas);

  return {
    quantidade: qtd, itens, custoTotal, custoPeca, preco,
    descontos, totalDescontos, lucroPeca,
    roiReal: custoPeca > 0 ? lucroPeca / custoPeca * 100 : 0,
    bloqueado, percTaxas, precoMinimo,
    lucroPorHora: horas > 0 ? lucroPeca * qtd / horas : 0
  };
}

export type AnalisePreco = {
  preco: number;
  descontos: Record<string, number>;
  lucroPeca: number;
  lucroTotal: number;
  roiReal: number;
  /** Quanto este preço fica abaixo (negativo) ou acima do calculado. */
  diferenca: number;
};

/**
 * O caminho de volta: o cliente pediu outro preço ("faz por R$ 25?").
 * Não muda o preço calculado; só diz quanto sobra se aceitar aquele valor,
 * descontando as mesmas taxas que o cálculo normal desconta.
 */
export function analisarPreco(entrada: Partial<EntradaPreco>, precoOferecido: number): AnalisePreco {
  const r = calcularPreco(entrada);
  const preco = Math.max(0, n(precoOferecido));
  const e = { ...entradaVazia(), ...entrada };
  const imposto = n(e.imposto) / 100;
  const marketplace = n(e.marketplace) / 100;
  const anuncios = n(e.roas) > 0 ? 1 / n(e.roas) : 0;
  const descontos: Record<string, number> = {
    Imposto: preco * imposto,
    Marketplace: preco * marketplace,
    'Taxa fixa': n(e.taxaFixa) / r.quantidade,
    'Anúncios': preco * anuncios
  };
  const lucroPeca = preco - r.custoPeca - Object.values(descontos).reduce((a, b) => a + b, 0);
  return {
    preco, descontos, lucroPeca,
    lucroTotal: lucroPeca * r.quantidade,
    roiReal: r.custoPeca > 0 ? lucroPeca / r.custoPeca * 100 : 0,
    diferenca: preco - r.preco
  };
}
