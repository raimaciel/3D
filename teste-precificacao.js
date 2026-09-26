/*
 * Testes do motor de precificação. Sem biblioteca nenhuma: node teste-precificacao.js
 *
 * Guarda três coisas:
 *   1. A identidade que a fórmula original já acertava (lucro / custo === ROI pedido).
 *   2. As correções dos dois defeitos do modo lote.
 *   3. As mudanças intencionais, comparadas contra a fórmula ORIGINAL, que está
 *      reproduzida aqui embaixo de propósito — para que qualquer divergência
 *      futura apareça como diferença explicada, e não como surpresa.
 */
const { calcularPrecificacao } = require('./precificacao.js');

let passou = 0, falhou = 0;
const brl = v => 'R$ ' + v.toFixed(2);

function ok(nome, condicao, detalhe) {
  if (condicao) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (detalhe ? '\n        ' + detalhe : '')); }
}
function quase(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol); }
function titulo(t) { console.log('\n' + t); }

// Fórmula ORIGINAL, como estava na calculadora antes das correções.
// Serve de referência histórica. Não corrija os defeitos aqui.
function original(i) {
  const qtd = i.lote ? Math.max(1, Math.round(i.qtd || 1)) : 1;
  const horas = (i.horas || 0) + (i.minutos || 0) / 60;
  const it = {
    Filamento: (i.peso || 0) / 1000 * (i.precoKg || 0),
    Energia: (i.potencia || 0) / 1000 * horas * (i.kwh || 0),
    Maquina: (i.vidaMaq || 0) > 0 ? (i.valorMaq || 0) / i.vidaMaq * horas : 0,
    MaoDeObra: (i.maoMin || 0) / 60 * (i.maoHora || 0),
    Extras: (i.extras || 0) * qtd
  };
  const base = Object.values(it).reduce((a, b) => a + b, 0);
  it.Falhas = (it.Filamento + it.Energia + it.Maquina) * (i.falha || 0) / 100;
  const custoPeca = (base + it.Falhas) / qtd;
  const imp = (i.imposto || 0) / 100, mkt = (i.taxa || 0) / 100;
  const ads = (i.roas || 0) > 0 ? 1 / i.roas : 0;
  const perc = imp + mkt + ads, roi = (i.roi || 0) / 100;
  const preco = perc >= 0.95 ? 0 : (custoPeca * (1 + roi) + (i.taxaFixa || 0)) / (1 - perc);
  return { custoPeca, preco, itens: it };
}

const base = {
  peso: 50, precoKg: 120, potencia: 150, kwh: 0.98, horas: 3, minutos: 30,
  valorMaq: 2500, vidaMaq: 5000, maoHora: 50, acabaMin: 10, preparoMin: 0,
  modelaHoras: 0, modelaHora: 0, falha: 0, extras: 2,
  imposto: 6, taxa: 0, taxaFixa: 0, roas: 0, roi: 250
};

titulo('1. O ROI entregue é exatamente o ROI pedido (a identidade central)');
for (const roi of [0, 50, 100, 250, 500, 1000]) {
  for (const taxas of [{}, { imposto: 6 }, { imposto: 6, taxa: 16 }, { imposto: 6, taxa: 16, roas: 4 },
                       { imposto: 6, taxa: 16, roas: 4, taxaFixa: 6 }]) {
    const r = calcularPrecificacao({ ...base, ...taxas, roi });
    ok(`ROI ${roi}% com ${JSON.stringify(taxas)}`, quase(r.roiReal, roi, 1e-9),
       `esperado ${roi}%, obtido ${r.roiReal}%`);
  }
}

titulo('2. A mesma identidade vale no modo lote, com tudo ligado');
{
  const r = calcularPrecificacao({ ...base, lote: true, qtd: 20, peso: 1000, preparoMin: 25,
    modelaHoras: 2, modelaHora: 80, falha: 8, imposto: 6, taxa: 16, roas: 4, taxaFixa: 6 });
  ok('ROI real === 250% num lote de 20 com modelagem, falha, taxas e anúncios',
     quase(r.roiReal, 250, 1e-9), `obtido ${r.roiReal}%`);
  ok('preço do lote = preço por peça x 20', quase(r.preco * 20, r.preco * r.qtd));
}

titulo('3. DEFEITO CORRIGIDO: acabamento por peça multiplica pela quantidade');
{
  const ent = { ...base, lote: true, qtd: 20, peso: 1000, acabaMin: 10, maoHora: 50 };
  const novo = calcularPrecificacao(ent);
  const velho = original({ ...ent, maoMin: 10 });
  const esperadoPorPeca = 10 / 60 * 50;
  ok('acabamento por peça = R$ 8,33', quase(novo.itens.Acabamento / 20, esperadoPorPeca, 1e-9),
     `obtido ${brl(novo.itens.Acabamento / 20)}`);
  ok('a fórmula antiga cobrava 20x menos', quase(velho.itens.MaoDeObra / 20, esperadoPorPeca / 20, 1e-9),
     `antiga dava ${brl(velho.itens.MaoDeObra / 20)} por peça`);
  console.log(`        antes ${brl(velho.custoPeca)} -> agora ${brl(novo.custoPeca)} de custo por peça`);
}

titulo('4. DEFEITO CORRIGIDO: taxa fixa por venda é rateada, não cobrada por peça');
{
  const ent = { ...base, lote: true, qtd: 20, peso: 1000, taxaFixa: 6, acabaMin: 0 };
  const novo = calcularPrecificacao(ent);
  ok('taxa fixa por peça = R$ 6,00 / 20', quase(novo.descontos['Taxa fixa'], 6 / 20, 1e-9),
     `obtido ${brl(novo.descontos['Taxa fixa'])}`);
  ok('taxa fixa somada no lote = R$ 6,00', quase(novo.descontos['Taxa fixa'] * 20, 6, 1e-9));
  const velho = original({ ...ent, maoMin: 0 });
  console.log(`        a fórmula antiga cobrava ${brl(6 * 20)} de taxa no lote inteiro`);
  console.log(`        preço por peça: antes ${brl(velho.preco)} -> agora ${brl(novo.preco)}`);
}

titulo('5. Preparo entra uma vez só; acabamento entra por peça');
{
  const r10 = calcularPrecificacao({ ...base, lote: true, qtd: 10, preparoMin: 30, acabaMin: 6 });
  const r20 = calcularPrecificacao({ ...base, lote: true, qtd: 20, preparoMin: 30, acabaMin: 6 });
  ok('preparo não muda quando a quantidade dobra', quase(r10.itens.Preparo, r20.itens.Preparo));
  ok('acabamento dobra quando a quantidade dobra', quase(r20.itens.Acabamento, r10.itens.Acabamento * 2));
}

titulo('6. Modelagem: linha própria, com taxa própria, uma vez por pedido');
{
  const r = calcularPrecificacao({ ...base, lote: true, qtd: 15, modelaHoras: 2.5, modelaHora: 90 });
  ok('modelagem = 2,5 h x R$ 90 = R$ 225', quase(r.itens.Modelagem, 225, 1e-9), brl(r.itens.Modelagem));
  const r30 = calcularPrecificacao({ ...base, lote: true, qtd: 30, modelaHoras: 2.5, modelaHora: 90 });
  ok('modelagem não muda com a quantidade', quase(r.itens.Modelagem, r30.itens.Modelagem));
  ok('modelagem usa taxa separada da mão de obra',
     quase(calcularPrecificacao({ ...base, modelaHoras: 1, modelaHora: 90, maoHora: 50 }).itens.Modelagem, 90));
}

titulo('7. Margem de falha: cobre material, máquina e trabalho — não modelagem nem embalagem');
{
  const e = { ...base, falha: 10, acabaMin: 12, preparoMin: 18, modelaHoras: 3, modelaHora: 100, extras: 5 };
  const r = calcularPrecificacao(e);
  const esperado = (r.itens.Filamento + r.itens.Energia + r.itens['Máquina']
                    + r.itens.Acabamento + r.itens.Preparo) * 0.10;
  ok('falhas incide sobre material, energia, máquina, acabamento e preparo',
     quase(r.itens.Falhas, esperado, 1e-9), `esperado ${brl(esperado)}, obtido ${brl(r.itens.Falhas)}`);
  const semModelagem = calcularPrecificacao({ ...e, modelaHoras: 0 });
  ok('modelagem não entra na margem de falha (o arquivo CAD sobrevive)',
     quase(r.itens.Falhas, semModelagem.itens.Falhas, 1e-9));
  const semExtras = calcularPrecificacao({ ...e, extras: 0 });
  ok('embalagem não entra na margem de falha', quase(r.itens.Falhas, semExtras.itens.Falhas, 1e-9));
  const velho = original({ ...e, maoMin: 12 });
  console.log(`        mudança intencional: antes a falha ignorava o trabalho humano`);
  console.log(`        falhas antes ${brl(velho.itens.Falhas)} -> agora ${brl(r.itens.Falhas)}`);
}

titulo('8. Trava de segurança quando as taxas consomem o preço');
{
  const r = calcularPrecificacao({ ...base, imposto: 40, taxa: 40, roas: 5 });
  ok('taxas em 100% bloqueiam o preço em vez de gerar número absurdo', r.bloqueado && r.preco === 0);
  const ok94 = calcularPrecificacao({ ...base, imposto: 47, taxa: 47 });
  ok('em 94% ainda calcula (não bloqueia)', !ok94.bloqueado && ok94.preco > 0);
}

titulo('9. Entradas vazias, texto e negativas não quebram o cálculo');
{
  const r = calcularPrecificacao({});
  ok('objeto vazio devolve zeros sem NaN', r.preco === 0 && r.custoPeca === 0 && !isNaN(r.preco));
  const s = calcularPrecificacao({ peso: 'abc', precoKg: undefined, qtd: null, roi: NaN });
  ok('valores inválidos viram zero', !isNaN(s.preco) && !isNaN(s.custoPeca));
  const d = calcularPrecificacao({ ...base, lote: true, qtd: 0 });
  ok('quantidade 0 no lote não divide por zero', isFinite(d.custoPeca) && d.qtd === 1);
  const v = calcularPrecificacao({ ...base, vidaMaq: 0 });
  ok('vida útil 0 não divide por zero', v.itens['Máquina'] === 0 && isFinite(v.preco));
}

titulo('10. Modo peça: o que NÃO deveria mudar continua igual à fórmula original');
{
  // Sem margem de falha, o modo peça tem que bater exatamente com a fórmula antiga.
  const e = { ...base, falha: 0, acabaMin: 10, preparoMin: 0, modelaHoras: 0, taxaFixa: 6,
              imposto: 6, taxa: 16, roas: 4 };
  const novo = calcularPrecificacao(e);
  const velho = original({ ...e, maoMin: 10 });
  ok('custo por peça idêntico ao original', quase(novo.custoPeca, velho.custoPeca, 1e-9),
     `${brl(novo.custoPeca)} vs ${brl(velho.custoPeca)}`);
  ok('preço idêntico ao original', quase(novo.preco, velho.preco, 1e-9),
     `${brl(novo.preco)} vs ${brl(velho.preco)}`);
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
