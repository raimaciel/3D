'use client';
/*
 * O campo de dinheiro de todo o sistema, com a máscara brasileira: os números
 * entram pelos centavos e o campo já mostra "R$ 5.242,20" enquanto se digita.
 * A regra da máscara mora em lib/dinheiro.ts, com testes.
 */
import type { InputHTMLAttributes } from 'react';
import { formatarDinheiro, valorDaMascara } from '@/lib/dinheiro';

type Props = {
  valor: number;
  aoMudar: (v: number) => void;
  /** 2 para dinheiro; 3 para a tarifa de energia (R$ 0,857/kWh). */
  casas?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

export function InputDinheiro({ valor, aoMudar, casas = 2, onFocus, ...resto }: Props) {
  return (
    <input
      inputMode="numeric"
      {...resto}
      value={formatarDinheiro(Number(valor) || 0, casas)}
      onChange={e => aoMudar(valorDaMascara(e.target.value, casas))}
      onFocus={e => {
        // O número entra pela direita: o cursor tem que estar no fim.
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        onFocus?.(e);
      }}
    />
  );
}
