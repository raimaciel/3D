/*
 * Testes da leitura do arquivo do fatiador.
 *   node --experimental-strip-types lib/fatiador.teste.ts
 *
 * Os arquivos aqui são montados à mão, no formato que cada fatiador escreve.
 * Falta ainda conferir com um arquivo real exportado da A1 do dono.
 */
import { deflateRawSync } from 'node:zlib';
import { tempoParaHoras, lerGcodeTexto, lerSliceInfo, lerFatiador, type LerPedaco } from './fatiador.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const quase = (a: number | null, b: number, tol = 1e-6) => a !== null && Math.abs(a - b) <= tol;
const titulo = (s: string) => console.log('\n' + s);

const leitor = (b: Uint8Array): LerPedaco => async (i, f) => b.slice(i, f);
const texto = (s: string) => new TextEncoder().encode(s);

/** Monta um ZIP de verdade, com compressão deflate (método 8) ou sem (método 0). */
function zip(arquivos: Record<string, string>, comprimir = true): Uint8Array {
  const locais: Buffer[] = [], indice: Buffer[] = [];
  let pos = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const cru = Buffer.from(conteudo), dados = comprimir ? deflateRawSync(cru) : cru;
    const n = Buffer.from(nome), metodo = comprimir ? 8 : 0;
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(metodo, 8);
    loc.writeUInt32LE(dados.length, 18); loc.writeUInt32LE(cru.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(metodo, 10);
    cen.writeUInt32LE(dados.length, 20); cen.writeUInt32LE(cru.length, 24); cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(pos, 42);
    locais.push(loc, n, dados); indice.push(cen, n);
    pos += 30 + n.length + dados.length;
  }
  const ind = Buffer.concat(indice);
  const fim = Buffer.alloc(22); fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8); fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(ind.length, 12); fim.writeUInt32LE(pos, 16);
  return new Uint8Array(Buffer.concat([...locais, ind, fim]));
}

const sliceInfo = (mesas: { peso: number; seg: number; objetos: string[] }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <header><header_item key="X-BBL-Client-Type" value="slicer"/></header>\n` +
  mesas.map((m, i) => `  <plate>\n    <metadata key="index" value="${i + 1}"/>\n` +
    `    <metadata key="prediction" value="${m.seg}"/>\n    <metadata key="weight" value="${m.peso}"/>\n` +
    m.objetos.map(o => `    <object identify_id="${Math.random()}" name="chaveiro" skipped="${o}" />\n`).join('') +
    `    <filament id="1" type="PLA" color="#FFFFFF" used_m="3.1" used_g="${m.peso}" />\n  </plate>\n`).join('') +
  `</config>\n`;

titulo('1. Tempo escrito por extenso');
ok('"1h 2m 3s"', quase(tempoParaHoras('1h 2m 3s'), 1 + 2 / 60 + 3 / 3600));
ok('"1d 2h"', quase(tempoParaHoras('1d 2h'), 26));
ok('"45m 10s"', quase(tempoParaHoras('45m 10s'), (45 * 60 + 10) / 3600));
ok('texto sem tempo devolve null', tempoParaHoras('nada') === null);

titulo('2. G-code de cada fatiador');
{
  const bambu = lerGcodeTexto('; HEADER_BLOCK_START\n; model printing time: 1h 5m 3s; total estimated time: 1h 11m 20s\n; total layer number: 120\n; total filament weight [g] : 20.54\n; HEADER_BLOCK_END\nG28\n');
  ok('Bambu: usa o tempo TOTAL, não só o do modelo', quase(bambu.horas, 1 + 11 / 60 + 20 / 3600));
  ok('Bambu: peso 20,54 g', quase(bambu.gramas, 20.54));
  const prusa = lerGcodeTexto('G1 X10\n; filament used [mm] = 5200.10\n; filament used [g] = 15.50\n; estimated printing time (normal mode) = 2h 30m 0s\n');
  ok('PrusaSlicer: 2,5 h', quase(prusa.horas, 2.5));
  ok('PrusaSlicer: 15,5 g', quase(prusa.gramas, 15.5));
  const orca = lerGcodeTexto('; total filament used [g] = 8.20\n; estimated printing time (normal mode) = 25m 0s\n');
  ok('OrcaSlicer: 8,2 g em 25 min', quase(orca.gramas, 8.2) && quase(orca.horas, 25 / 60));
  const dois = lerGcodeTexto('; filament used [g] = 12.00, 3.50\n; estimated printing time (normal mode) = 1h\n');
  ok('dois bicos: soma os pesos', quase(dois.gramas, 15.5));
  const cura = lerGcodeTexto(';FLAVOR:Marlin\n;TIME:5400\n;Filament used: 1.2m\n');
  ok('Cura: tempo em segundos vira 1,5 h', quase(cura.horas, 1.5));
  ok('Cura: sem peso em gramas, devolve null', cura.gramas === null);
}

titulo('3. slice_info do Bambu Studio');
{
  const um = lerSliceInfo(sliceInfo([{ peso: 12.34, seg: 4238, objetos: ['false'] }]));
  ok('uma mesa: peso e tempo', quase(um.gramas, 12.34) && quase(um.horas, 4238 / 3600));
  ok('uma peça na mesa', um.pecas === 1);
  const varias = lerSliceInfo(sliceInfo([
    { peso: 40, seg: 7200, objetos: ['false', 'false', 'false', 'false'] },
    { peso: 10, seg: 1800, objetos: ['false', 'true'] }]));
  ok('duas mesas: soma peso e tempo', quase(varias.gramas, 50) && quase(varias.horas, 2.5));
  ok('conta as peças e ignora as puladas', varias.pecas === 5, String(varias.pecas));
  const semFatiar = lerSliceInfo('<config><plate><metadata key="index" value="1"/></plate></config>');
  ok('projeto não fatiado: sem peso nem tempo', semFatiar.gramas === null && semFatiar.horas === null);
}

titulo('4. Arquivo .gcode.3mf de ponta a ponta');
{
  const info = sliceInfo([{ peso: 24, seg: 10800, objetos: ['false', 'false', 'false'] }]);
  const arq = zip({ '[Content_Types].xml': '<Types/>', 'Metadata/plate_1.gcode': 'G28\n'.repeat(500), 'Metadata/slice_info.config': info });
  const r = await lerFatiador('chaveiro.gcode.3mf', arq.length, leitor(arq));
  ok('lê 24 g, 3 h e 3 peças de dentro do ZIP comprimido', r.gramas === 24 && quase(r.horas, 3) && r.pecas === 3, JSON.stringify(r));
  const semComp = zip({ 'Metadata/slice_info.config': info }, false);
  const r2 = await lerFatiador('peca.3mf', semComp.length, leitor(semComp));
  ok('também lê ZIP sem compressão', r2.gramas === 24);
  const projeto = zip({ '3D/3dmodel.model': '<model/>' });
  let msg = '';
  try { await lerFatiador('projeto.3mf', projeto.length, leitor(projeto)); } catch (e) { msg = (e as Error).message; }
  ok('3MF sem fatiar explica o que fazer', /Exportar arquivo fatiado/.test(msg), msg);
  msg = '';
  const lixo = texto('isto não é zip nenhum');
  try { await lerFatiador('falso.3mf', lixo.length, leitor(lixo)); } catch (e) { msg = (e as Error).message; }
  ok('arquivo falso recusado com mensagem clara', /não é um 3MF válido/.test(msg), msg);
}

titulo('5. Arquivo .gcode de ponta a ponta');
{
  const grande = texto('; generated by PrusaSlicer\n' + 'G1 X1 Y1 E0.1\n'.repeat(60000) +
    '; filament used [g] = 33.30\n; estimated printing time (normal mode) = 4h 0m 0s\n');
  const r = await lerFatiador('peca.gcode', grande.length, leitor(grande));
  ok('G-code grande: acha os números no fim do arquivo', quase(r.gramas, 33.3) && quase(r.horas, 4), JSON.stringify(r));
  let msg = '';
  const cura = texto(';TIME:3600\nG28\n');
  try { await lerFatiador('cura.gcode', cura.length, leitor(cura)); } catch (e) { msg = (e as Error).message; }
  ok('Cura sem peso: avisa em vez de inventar', /não o peso/.test(msg), msg);
  msg = '';
  try { await lerFatiador('peca.stl', 10, leitor(texto('solid x'))); } catch (e) { msg = (e as Error).message; }
  ok('STL não é arquivo fatiado: explica', /arquivo fatiado/.test(msg), msg);
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
