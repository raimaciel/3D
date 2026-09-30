/*
 * Testes das regras do site público.
 *   node --experimental-strip-types lib/site.teste.ts
 */
import { ehEnderecoDoSite, fotoEhPublica, idDaFoto, linkWhatsApp, mensagemDaPeca, produtosDoSite } from './site.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const titulo = (s: string) => console.log('\n' + s);

titulo('1. Qual endereço mostra o site');
ok('fabricando3d.com.br é o site', ehEnderecoDoSite('fabricando3d.com.br'));
ok('www.fabricando3d.com.br é o site', ehEnderecoDoSite('www.fabricando3d.com.br'));
ok('com maiúsculas e porta, também', ehEnderecoDoSite('Fabricando3D.com.br:443'));
ok('gestao3d.fabricando3d.com.br NÃO é o site', !ehEnderecoDoSite('gestao3d.fabricando3d.com.br'));
ok('o workers.dev NÃO é o site', !ehEnderecoDoSite('3d.ranbm3.workers.dev'));
ok('localhost NÃO é o site', !ehEnderecoDoSite('localhost:8787'));
ok('endereço parecido de outra pessoa NÃO é o site', !ehEnderecoDoSite('fabricando3d.com.br.golpe.com'));
ok('sem endereço, NÃO é o site', !ehEnderecoDoSite(null));

titulo('2. O que vai para a vitrine');
{
  const foto = '/api/files/11111111-2222-3333-4444-555555555555';
  const produtos = [
    { id: 'a', name: 'Vaso geométrico', category: 'Decoração', description: 'PLA, 15 cm', color: 'Branco', weight: 120, hours: 6, cost: 30, showOnSite: true, sitePrice: 0, photo: foto },
    { id: 'b', name: 'Chaveiro com nome', category: 'Brindes', description: '', color: '', weight: 8, hours: 0.4, showOnSite: true, sitePrice: 12 },
    { id: 'c', name: 'Protótipo do cliente X', category: 'Sob medida', showOnSite: false, sitePrice: 99 },
    { id: 'd', name: 'Sem marcação', category: 'x' },
    { id: 'e', name: '   ', showOnSite: true },
  ];
  const v = produtosDoSite(produtos);
  ok('só os marcados "Mostrar no site" e com nome', v.map(p => p.id).join() === 'b,a', v.map(p => p.id).join());
  ok('em ordem de nome', v[0].nome === 'Chaveiro com nome');
  ok('preço zero vira "Peça seu orçamento" (null)', v.find(p => p.id === 'a')!.preco === null);
  ok('preço preenchido aparece', v.find(p => p.id === 'b')!.preco === 12);
  const campos = Object.keys(v[0]).sort().join();
  ok('só campos públicos: nada de custo, peso ou tempo', campos === 'categoria,cor,descricao,foto,id,nome,preco', campos);
  ok('a foto vira endereço público', v.find(p => p.id === 'a')!.foto === '/api/site/foto/11111111-2222-3333-4444-555555555555');
  ok('produto sem foto fica sem foto', v.find(p => p.id === 'b')!.foto === null);
  ok('lista inválida não quebra', produtosDoSite(null).length === 0 && produtosDoSite('x').length === 0);
  ok('foto de produto no site é pública', fotoEhPublica(produtos, '11111111-2222-3333-4444-555555555555'));
  ok('foto de produto fora do site NÃO é pública', !fotoEhPublica([{ id: 'c', name: 'X', showOnSite: false, photo: foto }], '11111111-2222-3333-4444-555555555555'));
  ok('foto que nenhum produto usa NÃO é pública', !fotoEhPublica(produtos, '99999999-2222-3333-4444-555555555555'));
  ok('id de foto só aceita o formato do sistema', idDaFoto('/api/files/../../segredo') === null && idDaFoto('https://outro.site/x.jpg') === null);
}

titulo('3. WhatsApp');
ok('link sem mensagem', linkWhatsApp() === 'https://wa.me/5585998393893');
{
  const l = linkWhatsApp(mensagemDaPeca('Chaveiro & "nome"'));
  ok('mensagem vai codificada no link', l.startsWith('https://wa.me/5585998393893?text=') && !l.includes(' ') && !l.includes('"'));
  ok('e volta igual ao abrir', decodeURIComponent(l.split('text=')[1]).includes('Chaveiro & "nome"'));
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
