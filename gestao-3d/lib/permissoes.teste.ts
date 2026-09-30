/*
 * Testes das permissões por pessoa.
 *   node --experimental-strip-types lib/permissoes.teste.ts
 */
import { filtrarEstado, MODULOS, modulosDoUsuario, PADRAO_EQUIPE, podeAcao } from './permissoes.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const titulo = (s: string) => console.log('\n' + s);

titulo('1. Quais módulos cada um tem');
ok('admin tem todos, mesmo com lista salva menor', modulosDoUsuario('admin', ['Pedidos']).length === MODULOS.length);
ok('equipe sem nada salvo recebe o padrão', modulosDoUsuario('equipe', undefined).join() === PADRAO_EQUIPE.join());
ok('o padrão não tem Financeiro, Investimentos nem Configurações',
  !PADRAO_EQUIPE.some(m => ['Financeiro', 'Investimentos', 'Configurações'].includes(m)));
ok('equipe com lista salva recebe só a lista', modulosDoUsuario('equipe', ['Pedidos', 'Financeiro']).join() === 'Pedidos,Financeiro');
ok('nome de módulo inventado é ignorado', modulosDoUsuario('equipe', ['Pedidos', 'Hacker']).join() === 'Pedidos');
ok('lista vazia salva = nenhum módulo (não volta ao padrão)', modulosDoUsuario('equipe', []).length === 0);

titulo('2. Ações bloqueadas no servidor');
const padrao = PADRAO_EQUIPE;
ok('equipe padrão cria orçamento', podeAcao('quote', undefined, padrao));
ok('equipe padrão registra produção', podeAcao('production', undefined, padrao));
ok('equipe padrão NÃO registra recebimento', !podeAcao('payment', undefined, padrao));
ok('equipe padrão NÃO paga conta', !podeAcao('payPurchase', undefined, padrao));
ok('equipe padrão registra compra de filamento (Materiais)', podeAcao('purchase', undefined, padrao));
ok('equipe padrão NÃO mexe em investimentos', !podeAcao('investment', undefined, padrao) && !podeAcao('investmentParcel', undefined, padrao));
ok('equipe padrão NÃO muda configurações', !podeAcao('settings', undefined, padrao) && !podeAcao('company', undefined, padrao));
ok('equipe padrão cadastra cliente', podeAcao('entity', 'customers', padrao));
ok('só Materiais cadastra filamento, mas não cliente', podeAcao('entity', 'materials', ['Materiais']) && !podeAcao('entity', 'customers', ['Materiais']));
ok('ação desconhecida é recusada', !podeAcao('apagarTudo', undefined, MODULOS));
ok('sem módulo nenhum, nada passa', !podeAcao('quote', undefined, []));

titulo('3. Dados que a pessoa recebe');
{
  const estado = { payments: [1], purchases: [2], investments: [3], tools: [4], orders: [5], settings: { energyRate: 1.12 } };
  const e = filtrarEstado(estado, padrao);
  ok('equipe padrão não recebe recebimentos', (e.payments as unknown[]).length === 0);
  ok('equipe padrão não recebe investimentos', (e.investments as unknown[]).length === 0);
  ok('equipe padrão recebe compras (aba Compras de Materiais)', (e.purchases as unknown[]).length === 1);
  ok('equipe padrão recebe pedidos e configurações', (e.orders as unknown[]).length === 1 && !!e.settings);
  const soPedidos = filtrarEstado(estado, ['Pedidos']);
  ok('só Pedidos: sem compras, sem ferramentas', (soPedidos.purchases as unknown[]).length === 0 && (soPedidos.tools as unknown[]).length === 0);
  const tudo = filtrarEstado(estado, MODULOS);
  ok('admin recebe tudo', JSON.stringify(tudo) === JSON.stringify(estado));
  ok('o estado original não é alterado', (estado.payments as unknown[]).length === 1);
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
