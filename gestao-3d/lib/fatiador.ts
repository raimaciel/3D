/*
 * Lê peso e tempo de impressão do arquivo que o fatiador gera, para ninguém
 * precisar copiar esses números à mão.
 *
 * Aceita:
 *   .gcode.3mf / .3mf  — o que o Bambu Studio exporta como "arquivo fatiado".
 *                        É um ZIP; os números ficam em Metadata/slice_info.config.
 *   .gcode             — Bambu Studio, OrcaSlicer, PrusaSlicer e Cura escrevem
 *                        comentários com peso e tempo no começo ou no fim.
 *
 * Tudo acontece no navegador: o arquivo não é enviado a lugar nenhum.
 * Nada de tela aqui, para poder testar no Node (lib/fatiador.teste.ts).
 */

export type LeituraFatiador = {
  /** Peso de filamento do arquivo inteiro (todas as peças da mesa), em gramas. */
  gramas: number;
  /** Tempo do arquivo inteiro, em horas. */
  horas: number;
  /** Quantas peças havia na mesa. 1 quando o arquivo não informa. */
  pecas: number;
};

/** "1d 2h 3m 4s", "2h 5m", "45m 10s" → horas. Devolve null se não achar nada. */
export function tempoParaHoras(texto: string): number | null {
  let segundos = 0, achou = false;
  const partes: [RegExp, number][] = [[/(\d+)\s*d/, 86400], [/(\d+)\s*h/, 3600], [/(\d+)\s*m(?!s)/, 60], [/(\d+)\s*s/, 1]];
  for (const [re, fator] of partes) {
    const m = texto.match(re);
    if (m) { segundos += Number(m[1]) * fator; achou = true; }
  }
  return achou ? segundos / 3600 : null;
}

/** Soma "12.34, 0.00, 3.10" → 15.44. Fatiador com vários bicos lista um valor por bico. */
function somaLista(texto: string): number | null {
  const valores = texto.split(',').map(v => Number(v.trim())).filter(v => Number.isFinite(v));
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

/** Procura peso e tempo nos comentários de um G-code (basta o começo e o fim do arquivo). */
export function lerGcodeTexto(texto: string): { gramas: number | null; horas: number | null } {
  const achar = (re: RegExp) => texto.match(re)?.[1] ?? null;

  // Em ordem de preferência: o tempo TOTAL vem antes do tempo só do modelo.
  const tempo =
    achar(/;\s*total estimated time\s*[:=]\s*([^;\r\n]+)/i) ??
    achar(/;\s*estimated printing time \(normal mode\)\s*=\s*([^\r\n]+)/i) ??
    achar(/;\s*model printing time\s*[:=]\s*([^;\r\n]+)/i);
  let horas = tempo ? tempoParaHoras(tempo) : null;
  const cura = achar(/;TIME:(\d+(?:\.\d+)?)/);
  if (horas === null && cura) horas = Number(cura) / 3600;

  const peso =
    achar(/;\s*total filament weight \[g\]\s*[:=]\s*([^\r\n]+)/i) ??
    achar(/;\s*total filament used \[g\]\s*[:=]\s*([^\r\n]+)/i) ??
    achar(/;\s*filament used \[g\]\s*[:=]\s*([^\r\n]+)/i);
  return { gramas: peso ? somaLista(peso) : null, horas };
}

/** Lê o slice_info.config do Bambu Studio, somando todas as mesas do arquivo. */
export function lerSliceInfo(xml: string): { gramas: number | null; horas: number | null; pecas: number } {
  let gramas = 0, segundos = 0, pecas = 0, temPeso = false, temTempo = false;
  const mesas = xml.match(/<plate>[\s\S]*?<\/plate>/g) ?? [];
  for (const mesa of mesas) {
    const meta = (chave: string) => mesa.match(new RegExp(`key="${chave}"\\s+value="([^"]*)"`))?.[1];
    const p = Number(meta('weight')), t = Number(meta('prediction'));
    if (Number.isFinite(p) && meta('weight') !== undefined) { gramas += p; temPeso = true; }
    if (Number.isFinite(t) && meta('prediction') !== undefined) { segundos += t; temTempo = true; }
    // Cada peça na mesa aparece como um <object>; as puladas não são impressas.
    pecas += (mesa.match(/<object\b[^>]*>/g) ?? []).filter(o => !/skipped="true"/.test(o)).length;
  }
  return { gramas: temPeso ? gramas : null, horas: temTempo ? segundos / 3600 : null, pecas: Math.max(1, pecas) };
}

/** Lê um pedaço do arquivo: do byte `inicio` até antes de `fim`. */
export type LerPedaco = (inicio: number, fim: number) => Promise<Uint8Array>;

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function descomprimir(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/**
 * Tira UM arquivo de dentro de um ZIP sem carregar o ZIP inteiro na memória:
 * lê o índice no fim do arquivo e depois só o pedaço que interessa.
 * Devolve null se o arquivo pedido não estiver lá.
 */
export async function extrairDoZip(ler: LerPedaco, tamanho: number, nome: string): Promise<Uint8Array | null> {
  const cauda = Math.min(tamanho, 65557);
  const fim = await ler(tamanho - cauda, tamanho);
  let eocd = -1;
  for (let i = fim.length - 22; i >= 0; i--) if (u32(fim, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('O arquivo não é um 3MF válido.');
  const qtd = u16(fim, eocd + 10), tamIndice = u32(fim, eocd + 12), inicioIndice = u32(fim, eocd + 16);
  const indice = await ler(inicioIndice, inicioIndice + tamIndice);

  let p = 0;
  for (let k = 0; k < qtd && u32(indice, p) === 0x02014b50; k++) {
    const metodo = u16(indice, p + 10), comprimido = u32(indice, p + 20);
    const lenNome = u16(indice, p + 28), lenExtra = u16(indice, p + 30), lenComent = u16(indice, p + 32);
    const local = u32(indice, p + 42);
    const este = new TextDecoder().decode(indice.subarray(p + 46, p + 46 + lenNome));
    if (este === nome) {
      const cab = await ler(local, local + 30);
      const inicio = local + 30 + u16(cab, 26) + u16(cab, 28);
      const dados = await ler(inicio, inicio + comprimido);
      if (metodo === 0) return dados;
      if (metodo === 8) return descomprimir(dados);
      throw new Error('O 3MF usa uma compressão que não sei ler.');
    }
    p += 46 + lenNome + lenExtra + lenComent;
  }
  return null;
}

const PEDACO_GCODE = 256 * 1024;

/**
 * Ponto de entrada da tela. `nome` decide o formato; `ler` busca os bytes.
 * Lança erro com mensagem pronta para mostrar quando não encontra os números.
 */
export async function lerFatiador(nome: string, tamanho: number, ler: LerPedaco): Promise<LeituraFatiador> {
  const n = nome.toLowerCase();
  if (n.endsWith('.3mf')) {
    const bytes = await extrairDoZip(ler, tamanho, 'Metadata/slice_info.config');
    const info = bytes ? lerSliceInfo(new TextDecoder().decode(bytes)) : null;
    if (!info || info.gramas === null || info.horas === null)
      throw new Error('Este 3MF não foi fatiado. No Bambu Studio, fatie e use Arquivo → Exportar → Exportar arquivo fatiado.');
    return { gramas: info.gramas, horas: info.horas, pecas: info.pecas };
  }
  if (n.endsWith('.gcode')) {
    // Bambu escreve no começo; PrusaSlicer e Orca, no fim. Lê as duas pontas.
    const comeco = await ler(0, Math.min(tamanho, PEDACO_GCODE));
    const final = tamanho > PEDACO_GCODE ? await ler(Math.max(PEDACO_GCODE, tamanho - PEDACO_GCODE), tamanho) : new Uint8Array();
    const texto = new TextDecoder().decode(comeco) + '\n' + new TextDecoder().decode(final);
    const r = lerGcodeTexto(texto);
    if (r.horas === null) throw new Error('Não achei o tempo de impressão neste G-code.');
    if (r.gramas === null) throw new Error('Este G-code informa o tempo, mas não o peso. (O Cura só informa metros de filamento.)');
    return { gramas: r.gramas, horas: r.horas, pecas: 1 };
  }
  throw new Error('Use o arquivo fatiado: .gcode.3mf do Bambu Studio, ou .gcode.');
}
