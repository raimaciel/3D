/* node --experimental-strip-types lib/arquivos.teste.ts */
import { aceitar, conteudoCombina, extensaoDe, nomeSeguro, LIMITE_MODELO, LIMITE_IMAGEM } from './arquivos.ts';

let passou = 0, falhou = 0;
const ok = (n: string, c: boolean, d?: string) => {
  if (c) { passou++; console.log('  ok   ' + n); }
  else { falhou++; console.log('  FALHA ' + n + (d ? '  ' + d : '')); }
};
const titulo = (s: string) => console.log('\n' + s);

/** Monta um STL binário válido: 80 de cabeçalho, 4 da contagem, 50 por triângulo. */
function stlBinario(triangulos: number) {
  const buf = new Uint8Array(84 + triangulos * 50);
  new DataView(buf.buffer).setUint32(80, triangulos, true);
  return buf;
}

titulo('1. Extensão');
{
  ok('pega .stl', extensaoDe('peca.STL') === 'stl');
  ok('pega .3mf', extensaoDe('caixa.3mf') === '3mf');
  ok('pega a última de nome com vários pontos', extensaoDe('v2.final.stl') === 'stl');
  ok('sem extensão devolve vazio', extensaoDe('semponto') === '');
}

titulo('2. O que é aceito');
{
  const a = aceitar('peca.stl', 1_000_000);
  ok('.stl é aceito como modelo', a.ok && a.categoria === 'modelo' && a.contentType === 'model/stl');
  const b = aceitar('caixa.3mf', 2_000_000);
  ok('.3mf é aceito como modelo', b.ok && b.categoria === 'modelo');
  const c = aceitar('foto.JPG', 500_000);
  ok('.jpg continua aceito como imagem', c.ok && c.categoria === 'imagem' && c.contentType === 'image/jpeg');
  ok('.exe é recusado', !aceitar('virus.exe', 1000).ok);
  ok('.pdf é recusado (por enquanto)', !aceitar('nota.pdf', 1000).ok);
  ok('sem extensão é recusado', !aceitar('arquivo', 1000).ok);
  ok('arquivo vazio é recusado', !aceitar('peca.stl', 0).ok);
  ok('STL acima de 50 MB é recusado', !aceitar('grande.stl', LIMITE_MODELO + 1).ok);
  ok('STL de exatamente 50 MB passa', aceitar('limite.stl', LIMITE_MODELO).ok);
  ok('imagem acima de 5 MB é recusada', !aceitar('foto.png', LIMITE_IMAGEM + 1).ok);
  ok('imagem grande não vira modelo por engano', !aceitar('foto.png', 20_000_000).ok);
}

titulo('3. Assinatura do conteúdo: STL binário');
{
  const s = stlBinario(120);
  ok('STL binário coerente é aceito', conteudoCombina('stl', s.slice(0, 200), s.length));
  ok('tamanho que não fecha com a contagem é recusado',
     !conteudoCombina('stl', s.slice(0, 200), s.length + 7));
  const zerado = stlBinario(0);
  ok('STL com zero triângulos é recusado', !conteudoCombina('stl', zerado.slice(0, 200), zerado.length));
}

titulo('4. Assinatura do conteúdo: STL em texto');
{
  const txt = new TextEncoder().encode('solid peca\n facet normal 0 0 1\n');
  ok('STL em texto é aceito', conteudoCombina('stl', txt, txt.length));
  ok('maiúsculas também', conteudoCombina('stl', new TextEncoder().encode('SOLID x'), 7));
  const lixo = new TextEncoder().encode('isto nao e um stl de jeito nenhum');
  ok('texto qualquer é recusado', !conteudoCombina('stl', lixo, lixo.length));
}

titulo('5. Assinatura do conteúdo: 3MF e imagens');
{
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  ok('3MF (pacote ZIP) é aceito', conteudoCombina('3mf', zip, 5000));
  ok('3MF que não é ZIP é recusado', !conteudoCombina('3mf', new Uint8Array([1, 2, 3, 4]), 5000));
  ok('PNG de verdade', conteudoCombina('png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 100));
  ok('JPEG de verdade', conteudoCombina('jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 100));
  ok('WebP de verdade', conteudoCombina('webp', new TextEncoder().encode('RIFF????WEBP'), 100));
  ok('PNG mentindo o nome é recusado', !conteudoCombina('png', new Uint8Array([0xff, 0xd8, 0xff]), 100));
}

titulo('6. O ataque que isto impede: renomear para passar');
{
  // Um executável renomeado para .stl. A extensão passa; o conteúdo não.
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // cabeçalho MZ
  ok('extensão .stl sozinha não basta', aceitar('malware.stl', 6).ok);
  ok('mas o conteúdo é barrado', !conteudoCombina('stl', exe, 6));
  const html = new TextEncoder().encode('<script>alert(1)</script>');
  ok('HTML renomeado para .png é barrado', !conteudoCombina('png', html, html.length));
}

titulo('7. Nome do arquivo no download');
{
  ok('tira acento', nomeSeguro('peça-coração.stl') === 'peca-coracao.stl');
  ok('bloqueia caminho', !nomeSeguro('../../etc/passwd').includes('/'));
  ok('bloqueia aspas e quebra de linha', !/["\r\n]/.test(nomeSeguro('a"b\r\nc.stl')));
  ok('nome vazio vira algo', nomeSeguro('') === 'arquivo');
  ok('corta nome gigante', nomeSeguro('a'.repeat(400) + '.stl').length <= 120);
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
