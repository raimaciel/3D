/*
 * Máscara de dinheiro no jeito brasileiro, como no app do banco: os números
 * digitados entram pela direita, nos centavos.
 *   digita 1       -> R$ 0,01
 *   digita 10500   -> R$ 105,00
 *   digita 524220  -> R$ 5.242,20
 * Pedido do dono (29/09/2026): antes o campo mostrava "524220" cru.
 *
 * `casas` existe para a tarifa de energia, que a conta de luz traz com três
 * casas (R$ 0,857/kWh). O resto do sistema usa duas.
 */

/** Só os dígitos do que foi digitado, lidos como a menor unidade (centavo). */
export function valorDaMascara(texto: string, casas = 2): number {
  const digitos = String(texto ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
  return digitos ? Number(digitos) / 10 ** casas : 0;
}

/** 5242.2 -> "R$ 5.242,20". */
export function formatarDinheiro(valor: number, casas = 2): string {
  const v = Number.isFinite(valor) ? valor : 0;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
