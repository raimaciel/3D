/*
 * Que arquivo o sistema aceita, e como conferir que ele é mesmo o que diz ser.
 *
 * A armadilha: navegador NÃO informa tipo confiável para STL e 3MF. Dependendo
 * do sistema, o campo vem vazio, vem "application/octet-stream" ou vem um tipo
 * inventado. Então a checagem é por EXTENSÃO mais ASSINATURA do conteúdo, e
 * nunca pelo que o navegador afirma.
 *
 * Sem referência à Cloudflare aqui: dá para testar no Node.
 */
export type Categoria = 'imagem' | 'modelo';

export const LIMITE_IMAGEM = 5 * 1024 * 1024;    // 5 MB
export const LIMITE_MODELO = 50 * 1024 * 1024;   // 50 MB

const IMAGENS: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'
};
const MODELOS: Record<string, string> = {
  stl: 'model/stl', '3mf': 'model/3mf'
};

export const extensaoDe = (nome: string): string => {
  const n = String(nome ?? '').toLowerCase();
  const p = n.lastIndexOf('.');
  return p < 0 ? '' : n.slice(p + 1);
};

export type Aceite =
  | { ok: true; categoria: Categoria; contentType: string; extensao: string }
  | { ok: false; erro: string };

/** Decide pela extensão e pelo tamanho. O conteúdo é conferido depois. */
export function aceitar(nome: string, tamanho: number): Aceite {
  const ext = extensaoDe(nome);
  if (!ext) return { ok: false, erro: 'O arquivo precisa ter uma extensão (.stl, .3mf, .jpg, .png ou .webp).' };
  if (!Number.isFinite(tamanho) || tamanho <= 0) return { ok: false, erro: 'Arquivo vazio.' };

  if (IMAGENS[ext]) {
    if (tamanho > LIMITE_IMAGEM) return { ok: false, erro: 'Imagem de até 5 MB.' };
    return { ok: true, categoria: 'imagem', contentType: IMAGENS[ext], extensao: ext };
  }
  if (MODELOS[ext]) {
    if (tamanho > LIMITE_MODELO) return { ok: false, erro: 'Arquivo 3D de até 50 MB.' };
    return { ok: true, categoria: 'modelo', contentType: MODELOS[ext], extensao: ext };
  }
  return { ok: false, erro: 'Aceitamos .stl e .3mf para peças, e .jpg, .png ou .webp para fotos.' };
}

const comeca = (b: Uint8Array, bytes: number[]) =>
  bytes.length <= b.length && bytes.every((x, i) => b[i] === x);

/**
 * Confere a assinatura do conteúdo contra a extensão. Recebe só o começo do
 * arquivo mais o tamanho total — não precisa carregar 50 MB na memória.
 *
 * STL binário não tem assinatura: o jeito de reconhecê-lo é a própria
 * aritmética do formato. São 80 bytes de cabeçalho, 4 bytes com a contagem de
 * triângulos, e 50 bytes por triângulo. Se a conta bater com o tamanho do
 * arquivo, é STL binário de verdade.
 */
export function conteudoCombina(extensao: string, inicio: Uint8Array, tamanhoTotal: number): boolean {
  switch (extensao) {
    case 'png':  return comeca(inicio, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg':
    case 'jpeg': return comeca(inicio, [0xff, 0xd8, 0xff]);
    case 'webp': return comeca(inicio, [0x52, 0x49, 0x46, 0x46]) &&
                        inicio.length >= 12 && comeca(inicio.slice(8), [0x57, 0x45, 0x42, 0x50]);
    // 3MF é um pacote ZIP.
    case '3mf':  return comeca(inicio, [0x50, 0x4b, 0x03, 0x04]);
    case 'stl': {
      if (inicio.length >= 84) {
        const dv = new DataView(inicio.buffer, inicio.byteOffset, inicio.byteLength);
        const triangulos = dv.getUint32(80, true);
        if (84 + triangulos * 50 === tamanhoTotal && triangulos > 0) return true;
      }
      // STL em texto começa com "solid".
      const txt = new TextDecoder().decode(inicio.slice(0, 6)).toLowerCase();
      return txt.startsWith('solid');
    }
    default: return false;
  }
}

/** Nome seguro para devolver ao navegador no download. */
export function nomeSeguro(nome: string): string {
  const limpo = String(nome ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return limpo || 'arquivo';
}
