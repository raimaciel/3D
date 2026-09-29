/*
 * Testes do motor unificado.
 *   node --experimental-strip-types lib/precificacao.teste.ts
 *
 * O teste mais importante é o primeiro: prova que, com os recursos exclusivos
 * do Gestão 3D desligados, este motor devolve exatamente o mesmo número do
 * motor da calculadora (../precificacao.js), que já estava em uso e testado.
 * Se essa equivalência quebrar, o preço mudou sem ninguém pedir.
 */
import { calcularPreco, analisarPreco, taxaHoraMaquina, type EntradaPreco } from './precificacao.ts';
import { createRequire } from 'node:module';
const { calcularPrecificacao } = createRequire(import.meta.url)('../../precificacao.js');

let passou = 0, falhou = 0;
const brl = (v: number) => 'R$ ' + v.toFixed(2);
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const quase = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const titulo = (s: string) => console.log('\n' + s);

const base: Partial<EntradaPreco> = {
  peso: 50, precoKg: 120, potencia: 150, tarifaKwh: 0.98, horas: 3.5,
  valorMaquina: 2500, vidaMaquina: 5000, acabamentoMin: 10, preparoMin: 0,
  maoHora: 50, embalagem: 2, falha: 0, imposto: 6, roi: 250
};

titulo('1. EQUIVALENCIA com o motor da calculadora (o teste que mais importa)');
{
  const casos = [
    { nome: 'peça simples', ent: { ...base } },
    { nome: 'com margem de falha', ent: { ...base, falha: 8 } },
    { nome: 'com preparo', ent: { ...base, preparoMin: 25, falha: 8 } },
    { nome: 'com modelagem', ent: { ...base, modelagemHoras: 2, modelagemHora: 90 } },
    { nome: 'lote de 20 com tudo', ent: { ...base, lote: true, quantidade: 20, peso: 1000,
        horas: 14, preparoMin: 25, modelagemHoras: 2, modelagemHora: 90, falha: 8,
        marketplace: 16, roas: 4, taxaFixa: 6 } }
  ];
  for (const { nome, ent } of casos) {
    const novo = calcularPreco(ent);
    const calc = calcularPrecificacao({
      lote: ent.lote, qtd: ent.quantidade, peso: ent.peso, precoKg: ent.precoKg,
      potencia: ent.potencia, kwh: ent.tarifaKwh, horas: ent.horas, minutos: 0,
      valorMaq: ent.valorMaquina, vidaMaq: ent.vidaMaquina,
      modelaHoras: ent.modelagemHoras, modelaHora: ent.modelagemHora,
      acabaMin: ent.acabamentoMin, preparoMin: ent.preparoMin, maoHora: ent.maoHora,
      extras: ent.embalagem, falha: ent.falha, imposto: ent.imposto,
      taxa: ent.marketplace, taxaFixa: ent.taxaFixa, roas: ent.roas, roi: ent.roi
    });
    ok(`${nome}: custo idêntico`, quase(novo.custoPeca, calc.custoPeca, 1e-9),
       `${brl(novo.custoPeca)} vs ${brl(calc.custoPeca)}`);
    ok(`${nome}: preço idêntico`, quase(novo.preco, calc.preco, 1e-9),
       `${brl(novo.preco)} vs ${brl(calc.preco)}`);
  }
}

titulo('2. O ROI entregue é o ROI pedido, com tudo ligado');
for (const roi of [0, 100, 250, 500]) {
  const r = calcularPreco({ ...base, roi, lote: true, quantidade: 12, peso: 600, horas: 9,
    manutencao: 3, pintura: true, taxaPintura: 2, acabamentoFixo: 1.5,
    modelagemHoras: 1.5, modelagemHora: 90, personalizacaoMin: 4,
    personalizacaoHora: 60, personalizacaoEscopo: 'peca', preparoMin: 20,
    falha: 7, marketplace: 16, roas: 4, taxaFixa: 6 });
  ok(`ROI ${roi}% com manutenção, pintura, personalização e taxas`,
     quase(r.roiReal, roi, 1e-9), `obtido ${r.roiReal}%`);
}

titulo('3. Linhas de custo que vieram do Gestão 3D');
{
  const r = calcularPreco({ ...base, manutencao: 5 });
  const esperado = (r.itens.Filamento + r.itens.Energia) * 0.05;
  ok('manutenção = % sobre filamento + energia', quase(r.itens['Manutenção'], esperado));

  const p = calcularPreco({ ...base, pintura: true, taxaPintura: 2, acabamentoFixo: 0 });
  ok('pintura = peso / 100 x taxa', quase(p.itens.Pintura, 50 / 100 * 2), brl(p.itens.Pintura));
  const sp = calcularPreco({ ...base, pintura: false, taxaPintura: 2 });
  ok('pintura desligada não cobra', sp.itens.Pintura === 0);
}

titulo('4. Personalização respeita o escopo (o que o Gestão 3D fazia melhor)');
{
  const ped = calcularPreco({ ...base, lote: true, quantidade: 10, personalizacaoMin: 6,
    personalizacaoHora: 60, personalizacaoEscopo: 'pedido' });
  const pec = calcularPreco({ ...base, lote: true, quantidade: 10, personalizacaoMin: 6,
    personalizacaoHora: 60, personalizacaoEscopo: 'peca' });
  ok('escopo pedido: cobra uma vez', quase(ped.itens['Personalização'], 6 / 60 * 60));
  ok('escopo peça: cobra 10x', quase(pec.itens['Personalização'], 6 / 60 * 60 * 10));
  ok('modelagem é sempre uma vez, independente da quantidade',
     quase(calcularPreco({ ...base, lote: true, quantidade: 50, modelagemHoras: 2, modelagemHora: 90 }).itens.Modelagem, 180));
}

titulo('5. Máquina: taxa informada ganha da derivada');
{
  ok('deriva de valor ÷ vida útil', quase(taxaHoraMaquina({ valorMaquina: 2500, vidaMaquina: 5000 }), 0.5));
  ok('taxa informada tem prioridade', quase(taxaHoraMaquina({ taxaMaquina: 3, valorMaquina: 2500, vidaMaquina: 5000 }), 3));
  ok('sem vida útil não divide por zero', taxaHoraMaquina({ valorMaquina: 2500, vidaMaquina: 0 }) === 0);
}

titulo('6. Margem de falha: cobre o que se perde, não o que sobrevive');
{
  const e = { ...base, falha: 10, manutencao: 4, pintura: true, taxaPintura: 2,
    preparoMin: 15, modelagemHoras: 3, modelagemHora: 100, embalagem: 5 };
  const r = calcularPreco(e);
  const esperado = (r.itens.Filamento + r.itens.Energia + r.itens['Máquina']
    + r.itens['Manutenção'] + r.itens.Pintura + r.itens.Preparo + r.itens.Acabamento) * 0.10;
  ok('incide sobre material, máquina, manutenção, pintura e trabalho', quase(r.itens.Falhas, esperado),
     `esperado ${brl(esperado)}, obtido ${brl(r.itens.Falhas)}`);
  ok('modelagem fica de fora (o arquivo CAD sobrevive)',
     quase(r.itens.Falhas, calcularPreco({ ...e, modelagemHoras: 0 }).itens.Falhas));
  ok('embalagem fica de fora (a peça perdida não foi embalada)',
     quase(r.itens.Falhas, calcularPreco({ ...e, embalagem: 0 }).itens.Falhas));
}

titulo('7. Taxa fixa por venda é rateada no lote');
{
  const r = calcularPreco({ ...base, lote: true, quantidade: 20, peso: 1000, taxaFixa: 6 });
  ok('somada no lote dá exatamente a taxa', quase(r.descontos['Taxa fixa'] * 20, 6));
}

titulo('8. Unidade de potência é WATT, não kW');
{
  const w = calcularPreco({ ...base, potencia: 150, tarifaKwh: 1, horas: 10 });
  ok('150 W por 10 h a R$1/kWh = R$ 1,50 de energia', quase(w.itens.Energia, 1.5), brl(w.itens.Energia));
  const kw = calcularPreco({ ...base, potencia: 0.15, tarifaKwh: 1, horas: 10 });
  ok('0,15 no campo custaria 1000x menos: a conversão importa',
     quase(w.itens.Energia / kw.itens.Energia, 1000));
}

titulo('9. Travas e entradas inválidas');
{
  ok('taxas somando 100% bloqueiam o preço',
     calcularPreco({ ...base, imposto: 50, marketplace: 50 }).bloqueado);
  const v = calcularPreco({});
  ok('entrada vazia não gera NaN', v.preco === 0 && !Number.isNaN(v.custoPeca));
  const s = calcularPreco({ ...base, peso: 'abc' as never, quantidade: null as never });
  ok('valores inválidos viram zero', !Number.isNaN(s.preco) && !Number.isNaN(s.custoPeca));
  ok('quantidade 0 no lote não divide por zero',
     Number.isFinite(calcularPreco({ ...base, lote: true, quantidade: 0 }).custoPeca));
}

titulo('10. Custo fixo do mês');
{
  const sem = calcularPreco({ ...base });
  const zerado = calcularPreco({ ...base, custoFixoMes: 300, pecasMes: 0 });
  ok('sem peças por mês informadas, o custo fixo não entra', quase(zerado.preco, sem.preco));
  const com = calcularPreco({ ...base, custoFixoMes: 300, pecasMes: 100 });
  ok('R$ 300 no mês ÷ 100 peças = R$ 3 por peça', quase(com.itens['Custo fixo'], 3), brl(com.itens['Custo fixo']));
  const lote = calcularPreco({ ...base, lote: true, quantidade: 10, peso: 500, horas: 35,
    custoFixoMes: 300, pecasMes: 100 });
  ok('num lote de 10, cada peça paga a sua parte: R$ 30', quase(lote.itens['Custo fixo'], 30));
  const comFalha = calcularPreco({ ...base, falha: 10, custoFixoMes: 300, pecasMes: 100 });
  const semFalha = calcularPreco({ ...base, falha: 10 });
  ok('a margem de falha não cobre o custo fixo',
     quase(comFalha.itens.Falhas, semFalha.itens.Falhas));
  ok('com custo fixo, o ROI pedido continua exato', quase(com.roiReal, 250, 1e-6), com.roiReal.toFixed(6));
}

titulo('11. Preço mínimo e lucro por hora');
{
  const r = calcularPreco({ ...base, marketplace: 16, taxaFixa: 6 });
  const noMinimo = analisarPreco({ ...base, marketplace: 16, taxaFixa: 6 }, r.precoMinimo);
  ok('vender no preço mínimo dá lucro zero', quase(noMinimo.lucroPeca, 0, 1e-9), brl(noMinimo.lucroPeca));
  ok('o preço mínimo fica abaixo do calculado', r.precoMinimo < r.preco);
  const lote = calcularPreco({ ...base, lote: true, quantidade: 4, peso: 200, horas: 14 });
  ok('lucro por hora = lucro do lote ÷ horas de impressora',
     quase(lote.lucroPorHora, lote.lucroPeca * 4 / 14), brl(lote.lucroPorHora));
  ok('sem horas, lucro por hora é zero e não divide por zero',
     calcularPreco({ ...base, horas: 0 }).lucroPorHora === 0);
}

titulo('12. Cliente pediu outro preço');
{
  const ent = { ...base, imposto: 6, marketplace: 16, roas: 5, taxaFixa: 6 };
  const r = calcularPreco(ent);
  const mesmo = analisarPreco(ent, r.preco);
  ok('no preço calculado, a análise devolve o mesmo lucro', quase(mesmo.lucroPeca, r.lucroPeca, 1e-9));
  ok('no preço calculado, a diferença é zero', quase(mesmo.diferenca, 0, 1e-9));
  const desconto = analisarPreco(ent, r.preco * 0.8);
  ok('com 20% de desconto, o lucro cai', desconto.lucroPeca < r.lucroPeca);
  ok('as taxas percentuais caem junto com o preço',
     quase(desconto.descontos.Marketplace, r.preco * 0.8 * 0.16, 1e-9));
  ok('a taxa fixa não cai com o desconto', quase(desconto.descontos['Taxa fixa'], 6));
  ok('preço baixo demais mostra prejuízo', analisarPreco(ent, 1).lucroPeca < 0);
  ok('preço inválido vira zero, sem NaN', !Number.isNaN(analisarPreco(ent, 'x' as never).lucroPeca));
}

titulo('13. Insumos (argola, saquinho, caixa...)');
{
  const sem = calcularPreco({ ...base });
  const zero = calcularPreco({ ...base, insumos: 0 });
  ok('insumo zero não muda o preço', quase(zero.preco, sem.preco));
  const um = calcularPreco({ ...base, insumos: 1.5 });
  ok('R$ 1,50 de insumos numa peça', quase(um.itens.Insumos, 1.5), brl(um.itens.Insumos));
  const lote = calcularPreco({ ...base, lote: true, quantidade: 20, peso: 1000, horas: 70, insumos: 1.5 });
  ok('num lote de 20, cada peça leva os seus: R$ 30', quase(lote.itens.Insumos, 30));
  const falhaCom = calcularPreco({ ...base, falha: 10, insumos: 5 });
  const falhaSem = calcularPreco({ ...base, falha: 10 });
  ok('a margem de falha não cobre insumos', quase(falhaCom.itens.Falhas, falhaSem.itens.Falhas));
  const comTaxas = calcularPreco({ ...base, insumos: 2, imposto: 6, marketplace: 16, roas: 5, taxaFixa: 6 });
  ok('com insumos e taxas, o ROI pedido continua exato', quase(comTaxas.roiReal, 250, 1e-6), comTaxas.roiReal.toFixed(6));
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
