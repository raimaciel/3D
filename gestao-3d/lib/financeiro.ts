/*
 * Contas do Financeiro e dos Investimentos. Nada de tela nem de banco aqui:
 * entram números, saem números, para poder testar no Node
 * (lib/financeiro.teste.ts).
 */

export type PedidoParaRetorno = {
  id: string;
  /** Quanto o cliente vai pagar no total. */
  receita: number;
  /** Lucro do pedido inteiro, já descontadas as taxas. */
  lucro: number;
};
export type Recebimento = { orderId: string; amount: number };

/**
 * "Quanto já voltou" do que foi investido: o lucro dos pedidos, contado na
 * proporção do que o cliente JÁ PAGOU. Pedido pago inteiro conta o lucro
 * inteiro; pago pela metade conta metade do lucro; sem pagamento, nada.
 * Decisão do dono (29/09/2026): "o que o cliente pagou menos o custo da peça".
 */
export function lucroRecebido(pedidos: PedidoParaRetorno[], recebimentos: Recebimento[]): number {
  let total = 0;
  for (const p of pedidos) {
    if (!(p.receita > 0)) continue;
    const pago = recebimentos.filter(r => r.orderId === p.id).reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const fracao = Math.min(1, Math.max(0, pago / p.receita));
    total += (Number(p.lucro) || 0) * fracao;
  }
  return total;
}

export type Retorno = {
  investido: number;
  voltou: number;
  /** Quanto ainda falta voltar. Zero quando já voltou tudo. */
  falta: number;
  /** De 0 a 100 (ou mais, se já passou do investido). */
  percentual: number;
};

export function retornoDoInvestimento(investido: number, voltou: number): Retorno {
  const inv = Math.max(0, Number(investido) || 0), vol = Number(voltou) || 0;
  return {
    investido: inv, voltou: vol,
    falta: Math.max(0, inv - vol),
    percentual: inv > 0 ? (vol / inv) * 100 : 0,
  };
}

export type SituacaoVencimento = {
  tom: 'atrasada' | 'hoje' | 'breve' | 'ok';
  texto: string;
  /** Negativo = dias de atraso. */
  dias: number;
};

/** Dias entre duas datas "AAAA-MM-DD", sem fuso horário atrapalhando. */
function diasEntre(de: string, ate: string): number {
  const dia = (s: string) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d) / 86400000; };
  return Math.round(dia(ate) - dia(de));
}

/**
 * Situação de uma conta a pagar pelo vencimento. `hoje` e `vencimento` no
 * formato "AAAA-MM-DD". Conta paga não passa por aqui.
 */
export function situacaoVencimento(vencimento: string, hoje: string): SituacaoVencimento {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento || '')) return { tom: 'ok', texto: '', dias: 0 };
  const dias = diasEntre(hoje, vencimento);
  if (dias < 0) return { tom: 'atrasada', texto: dias === -1 ? 'Atrasada há 1 dia' : `Atrasada há ${-dias} dias`, dias };
  if (dias === 0) return { tom: 'hoje', texto: 'Vence hoje', dias };
  if (dias <= 3) return { tom: 'breve', texto: dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`, dias };
  return { tom: 'ok', texto: '', dias };
}
