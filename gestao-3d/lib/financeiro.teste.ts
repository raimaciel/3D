/*
 * Testes das contas do Financeiro e dos Investimentos.
 *   node --experimental-strip-types lib/financeiro.teste.ts
 */
import { lucroRecebido, retornoDoInvestimento, situacaoVencimento } from './financeiro.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const quase = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const titulo = (s: string) => console.log('\n' + s);

titulo('1. Quanto já voltou: lucro na proporção do que foi pago');
{
  const pedidos = [
    { id: 'a', receita: 100, lucro: 50 },
    { id: 'b', receita: 200, lucro: 80 },
    { id: 'c', receita: 60, lucro: 30 },
  ];
  ok('sem nenhum pagamento, nada voltou', lucroRecebido(pedidos, []) === 0);
  ok('pedido pago inteiro conta o lucro inteiro', quase(lucroRecebido(pedidos, [{ orderId: 'a', amount: 100 }]), 50));
  ok('pedido pago pela metade conta metade do lucro', quase(lucroRecebido(pedidos, [{ orderId: 'b', amount: 100 }]), 40));
  ok('dois pagamentos no mesmo pedido somam', quase(lucroRecebido(pedidos, [{ orderId: 'b', amount: 50 }, { orderId: 'b', amount: 150 }]), 80));
  ok('pagar a mais não conta mais que o lucro', quase(lucroRecebido(pedidos, [{ orderId: 'c', amount: 999 }]), 30));
  ok('vários pedidos somam', quase(lucroRecebido(pedidos, [
    { orderId: 'a', amount: 100 }, { orderId: 'b', amount: 100 }, { orderId: 'c', amount: 60 }]), 50 + 40 + 30));
  ok('pedido com prejuízo desconta do que voltou', quase(lucroRecebido([{ id: 'x', receita: 10, lucro: -4 }], [{ orderId: 'x', amount: 10 }]), -4));
  ok('pedido sem receita não divide por zero', lucroRecebido([{ id: 'z', receita: 0, lucro: 5 }], [{ orderId: 'z', amount: 5 }]) === 0);
  ok('pagamento de pedido que não existe é ignorado', lucroRecebido(pedidos, [{ orderId: 'nao-existe', amount: 100 }]) === 0);
}

titulo('2. Retorno do investimento');
{
  const r = retornoDoInvestimento(3000, 750);
  ok('investiu 3000, voltou 750: falta 2250', r.falta === 2250);
  ok('investiu 3000, voltou 750: 25%', quase(r.percentual, 25));
  const passou = retornoDoInvestimento(1000, 1200);
  ok('quando passa do investido, falta é zero', passou.falta === 0);
  ok('e o percentual passa de 100', quase(passou.percentual, 120));
  ok('sem investimento, percentual zero sem dividir por zero', retornoDoInvestimento(0, 50).percentual === 0);
}

titulo('3. Vencimento das contas a pagar');
{
  const hoje = '2026-09-29';
  ok('venceu ontem: atrasada há 1 dia', situacaoVencimento('2026-09-28', hoje).texto === 'Atrasada há 1 dia');
  ok('venceu há 10 dias', situacaoVencimento('2026-09-19', hoje).texto === 'Atrasada há 10 dias');
  ok('atrasada tem tom de atraso', situacaoVencimento('2026-09-19', hoje).tom === 'atrasada');
  ok('vence hoje', situacaoVencimento('2026-09-29', hoje).tom === 'hoje');
  ok('vence amanhã', situacaoVencimento('2026-09-30', hoje).texto === 'Vence amanhã');
  ok('vence em 3 dias, virando o mês', situacaoVencimento('2026-10-02', hoje).texto === 'Vence em 3 dias');
  ok('com 4 dias ou mais, sem aviso', situacaoVencimento('2026-10-03', hoje).tom === 'ok');
  ok('virada de ano conta certo', situacaoVencimento('2026-12-31', '2027-01-02').texto === 'Atrasada há 2 dias');
  ok('data vazia não quebra', situacaoVencimento('', hoje).tom === 'ok');
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
