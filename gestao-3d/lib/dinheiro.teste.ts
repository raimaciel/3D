/*
 * Testes da máscara de dinheiro.
 *   node --experimental-strip-types lib/dinheiro.teste.ts
 */
import { formatarDinheiro, valorDaMascara } from './dinheiro.ts';

let passou = 0, falhou = 0;
const ok = (nome: string, cond: boolean, det?: string) => {
  if (cond) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (det ? '\n        ' + det : '')); }
};
const titulo = (s: string) => console.log('\n' + s);
const sp = (s: string) => s.replace(/ /g, ' ');

titulo('1. Digitando, os números entram pelos centavos');
ok('1 -> 0,01', valorDaMascara('1') === 0.01);
ok('10500 -> 105,00', valorDaMascara('10500') === 105);
ok('524220 -> 5.242,20 (o caso do print do dono)', valorDaMascara('524220') === 5242.2);
ok('10000 -> 100,00', valorDaMascara('10000') === 100);

titulo('2. O campo já mostra "R$ 105,00"; o próximo dígito continua a conta');
ok('"R$ 105,00" + 5 -> 1.050,05', valorDaMascara('R$ 105,005') === 1050.05);
ok('apagar o último dígito de "R$ 105,00" -> 10,50', valorDaMascara('R$ 105,0') === 10.5);
ok('com ponto de milhar no meio', valorDaMascara('R$ 5.242,201') === 52422.01);
ok('apagar tudo -> zero', valorDaMascara('') === 0);
ok('só "R$ " -> zero', valorDaMascara('R$ ') === 0);
ok('letras são ignoradas', valorDaMascara('abc12') === 0.12);
ok('zeros à esquerda não viram nada', valorDaMascara('R$ 0,012') === 0.12);

titulo('3. Formato na tela');
ok('5242.2 -> R$ 5.242,20', sp(formatarDinheiro(5242.2)) === 'R$ 5.242,20', sp(formatarDinheiro(5242.2)));
ok('105 -> R$ 105,00', sp(formatarDinheiro(105)) === 'R$ 105,00');
ok('zero -> R$ 0,00', sp(formatarDinheiro(0)) === 'R$ 0,00');
ok('valor inválido -> R$ 0,00', sp(formatarDinheiro(NaN)) === 'R$ 0,00');
ok('1234567.89 -> R$ 1.234.567,89', sp(formatarDinheiro(1234567.89)) === 'R$ 1.234.567,89');

titulo('4. Tarifa de energia com três casas');
ok('digita 857 -> 0,857', valorDaMascara('857', 3) === 0.857);
ok('1120 -> 1,120', valorDaMascara('1120', 3) === 1.12);
ok('mostra R$ 0,857', sp(formatarDinheiro(0.857, 3)) === 'R$ 0,857');

titulo('5. Ida e volta: o que aparece, relido, dá o mesmo valor');
for (const v of [0.01, 1, 9.99, 105, 5242.2, 99999.99]) {
  ok(`${v} sobrevive a formatar e reler`, valorDaMascara(formatarDinheiro(v)) === v, String(valorDaMascara(formatarDinheiro(v))));
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
