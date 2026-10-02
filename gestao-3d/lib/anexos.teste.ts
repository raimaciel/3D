/*
 * Testes de anexar e remover arquivo de um pedido já existente (02/10/2026).
 *   node --experimental-strip-types lib/anexos.teste.ts
 *
 * Caso real: o cliente manda o STL pelo WhatsApp depois de o orçamento ser
 * aprovado. O arquivo vai para a peça certa do pedido.
 */
import { applyAction, emptyState, type Order, type State } from './domain.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const titulo = (s: string) => console.log('\n' + s);
const erro = (f: () => unknown): string => { try { f(); return ''; } catch (e) { return e instanceof Error ? e.message : String(e); } };

const A = '/api/files/11111111-2222-3333-4444-555555555555';
const B = '/api/files/22222222-2222-3333-4444-555555555555';
const arq = (url: string, nome = 'peca.stl') => ({ url, nome });

function estadoComPedido(): State {
  const s = emptyState();
  const item = (id: string, nome: string) => ({ id, name: nome, category: 'Brindes', materialId: 'm', printerId: 'p', calculation: {} as any, arquivos: [], cost: 1, revenue: 2, grams: 8 });
  s.orders.push({
    id: 'ped1', number: 1, customerId: 'c', customerName: 'João', date: '2026-10-02', due: '2026-10-10', notes: '',
    items: [item('i1', 'Chaveiro com nome'), item('i2', 'Suporte de celular')], cost: 2, revenue: 4, status: 'Aprovado',
    quoteId: 'q1', stage: 'Na fila', printed: false, painted: false, packed: false, delivered: false, photos: [],
  } as Order);
  return s;
}
const itens = (s: State) => s.orders[0].items;

titulo('1. Anexar');
{
  const s = applyAction(estadoComPedido(), { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(A, 'chaveiro-joao.stl') });
  ok('o arquivo vai para a peça escolhida', itens(s)[0].arquivos.length === 1 && itens(s)[0].arquivos[0].nome === 'chaveiro-joao.stl');
  ok('a outra peça do pedido não recebe nada', itens(s)[1].arquivos.length === 0);
  const s2 = applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(B, 'foto.jpg') });
  ok('dá para anexar mais de um na mesma peça', itens(s2)[0].arquivos.map(a => a.url).join() === A + ',' + B);
  ok('o mesmo arquivo duas vezes é recusado', /já está anexado/.test(erro(() => applyAction(s2, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(A) }))));
}
{
  let s = estadoComPedido();
  for (let n = 0; n < 10; n++) s = applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i2', arquivo: arq(`/api/files/${String(n).repeat(8)}-2222-3333-4444-555555555555`) });
  ok('aceita até 10 por peça', itens(s)[1].arquivos.length === 10);
  const decimo1 = '/api/files/aaaaaaaa-2222-3333-4444-555555555555';
  ok('o 11º é recusado, com mensagem clara', /até 10 arquivos/.test(erro(() => applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i2', arquivo: arq(decimo1) }))));
}
{
  const s = estadoComPedido();
  // Pedido antigo, salvo antes de existir a lista de anexos na peça.
  delete (s.orders[0].items[0] as any).arquivos;
  const s2 = applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(A) });
  ok('peça de pedido antigo, sem lista de anexos, também aceita', itens(s2)[0].arquivos.length === 1);
}

titulo('2. O que é recusado ao anexar');
{
  const s = estadoComPedido();
  ok('pedido que não existe', /Pedido não encontrado/.test(erro(() => applyAction(s, { type: 'attachFile', id: 'xx', itemId: 'i1', arquivo: arq(A) }))));
  ok('peça que não existe no pedido', /Peça não encontrada/.test(erro(() => applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'zz', arquivo: arq(A) }))));
  ok('endereço que não é do sistema (link de fora)', erro(() => applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq('https://golpe.com/x.stl') })) !== '');
  ok('endereço tentando sair da pasta', erro(() => applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq('/api/files/../../segredo') })) !== '');
  ok('arquivo sem nome', erro(() => applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(A, '  ') })) !== '');
  ok('nada foi gravado depois das recusas', itens(s).every(i => i.arquivos.length === 0));
}

titulo('3. Remover');
{
  let s = estadoComPedido();
  s = applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(A) });
  s = applyAction(s, { type: 'attachFile', id: 'ped1', itemId: 'i1', arquivo: arq(B) });
  const s2 = applyAction(s, { type: 'removeFile', id: 'ped1', itemId: 'i1', url: A });
  ok('tira só o arquivo escolhido', itens(s2)[0].arquivos.map(a => a.url).join() === B);
  ok('remover o que não está anexado é recusado', /não está anexado/.test(erro(() => applyAction(s2, { type: 'removeFile', id: 'ped1', itemId: 'i1', url: A }))));
  ok('remover de outra peça é recusado', /não está anexado/.test(erro(() => applyAction(s2, { type: 'removeFile', id: 'ped1', itemId: 'i2', url: B }))));
  ok('endereço inválido é recusado', erro(() => applyAction(s2, { type: 'removeFile', id: 'ped1', itemId: 'i1', url: 'https://golpe.com' })) !== '');
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
