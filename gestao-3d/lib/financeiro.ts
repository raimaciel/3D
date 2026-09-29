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

/* ------------------------------------------------------------------------ */
/* Parcelas de um investimento (29/09/2026)                                  */
/* O dono marca cada parcela como paga, à mão; a tela lembra quando uma     */
/* parcela venceu e não foi marcada. Parcelas NÃO vão para Contas a pagar,  */
/* porque a fatura do cartão já é lançada lá (contaria em dobro).           */
/* ------------------------------------------------------------------------ */

/** Soma `meses` a uma data "AAAA-MM-DD". Dia 31 em mês de 30 dias vira o último dia do mês. */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Divide o total em `n` parcelas em centavos exatos: as primeiras levam o
 * valor arredondado para baixo, a última leva a sobra. 100 em 3 = 33,33 +
 * 33,33 + 33,34, e a soma bate com o total.
 */
export function valoresDasParcelas(total: number, n: number): number[] {
  const qtd = Math.max(1, Math.floor(n) || 1);
  const centavos = Math.round((Number(total) || 0) * 100);
  const base = Math.floor(centavos / qtd);
  return Array.from({ length: qtd }, (_, i) => (i === qtd - 1 ? centavos - base * (qtd - 1) : base) / 100);
}

export type Parcela = {
  numero: number;          // 1, 2, 3...
  vencimento: string;      // "AAAA-MM-DD"
  valor: number;
  paga: boolean;
  situacao: SituacaoVencimento;
};

export type ResumoParcelas = {
  parcelas: Parcela[];
  pagas: number;
  total: number;
  valorPago: number;
  valorFalta: number;
  /** Parcelas que já venceram e não foram marcadas como pagas: viram lembrete. */
  atrasadas: Parcela[];
  /** A próxima parcela a pagar, ou null se tudo foi pago. */
  proxima: Parcela | null;
  quitado: boolean;
};

/**
 * As parcelas de uma compra parcelada. `pagasMarcadas` são os números das
 * parcelas que o dono marcou como pagas.
 */
export function resumoParcelas(total: number, n: number, primeiroVencimento: string, pagasMarcadas: number[], hoje: string): ResumoParcelas {
  const valores = valoresDasParcelas(total, n);
  const marcadas = new Set((pagasMarcadas || []).map(Number));
  const temData = /^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento || '');
  const parcelas: Parcela[] = valores.map((valor, i) => {
    const vencimento = temData ? somarMeses(primeiroVencimento, i) : '';
    const paga = marcadas.has(i + 1);
    return { numero: i + 1, vencimento, valor, paga,
      situacao: paga ? { tom: 'ok', texto: '', dias: 0 } : situacaoVencimento(vencimento, hoje) };
  });
  const pagas = parcelas.filter(p => p.paga);
  const valorPago = pagas.reduce((a, p) => a + p.valor, 0);
  const abertas = parcelas.filter(p => !p.paga);
  return {
    parcelas, pagas: pagas.length, total: parcelas.length,
    valorPago: Math.round(valorPago * 100) / 100,
    valorFalta: Math.round((Number(total) - valorPago) * 100) / 100,
    atrasadas: abertas.filter(p => p.situacao.tom === 'atrasada'),
    proxima: abertas[0] || null,
    quitado: abertas.length === 0,
  };
}
