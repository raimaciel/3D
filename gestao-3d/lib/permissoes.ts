/*
 * Permissões por pessoa (30/09/2026). Pedido do dono: o admin marca quais
 * módulos cada funcionário acessa.
 *
 * A PROTEÇÃO DE VERDADE É NO SERVIDOR: quem não tem o módulo não RECEBE os
 * dados dele (filtrarEstado) e não consegue ALTERAR nada nele (podeAcao).
 * O menu escondido é só cortesia. Usado pela rota /api/workspace e pela tela.
 *
 * Sem nada de tela nem de banco aqui, para testar no Node
 * (lib/permissoes.teste.ts).
 */

/** Módulos que se liga e desliga. "Visão geral" é de todos (sem valores de
 *  dinheiro para quem não tem Financeiro); "Usuários" é só do admin. */
export const MODULOS = ['Precificação', 'Orçamentos', 'Pedidos', 'Produção', 'Materiais', 'Cadastros', 'Financeiro', 'Investimentos', 'Configurações'] as const;
export type Modulo = typeof MODULOS[number];

/** Padrão aprovado pelo dono para quem trabalha na produção. */
export const PADRAO_EQUIPE: Modulo[] = ['Precificação', 'Orçamentos', 'Pedidos', 'Produção', 'Materiais', 'Cadastros'];

/** Módulos que a pessoa acessa. Admin: todos. Sem nada salvo: o padrão. */
export function modulosDoUsuario(papel: string, salvos: unknown): Modulo[] {
  if (papel === 'admin') return [...MODULOS];
  if (!Array.isArray(salvos)) return [...PADRAO_EQUIPE];
  return MODULOS.filter(m => salvos.includes(m));
}

const tem = (mods: readonly string[], ...algum: Modulo[]) => algum.some(m => mods.includes(m));

/**
 * Esta ação do sistema pode ser feita por quem tem estes módulos?
 * `tipo` é o action.type; `cadastro` é o action.kind da ação "entity".
 * Ação que não está na lista é recusada: o que não foi pensado não passa.
 */
export function podeAcao(tipo: string, cadastro: string | undefined, mods: readonly string[]): boolean {
  switch (tipo) {
    case 'quote': return tem(mods, 'Precificação', 'Orçamentos');
    case 'approve': return tem(mods, 'Orçamentos');
    case 'production': case 'photo': return tem(mods, 'Produção', 'Pedidos');
    case 'payment': case 'payPurchase': return tem(mods, 'Financeiro');
    case 'purchase': return tem(mods, 'Financeiro', 'Materiais');
    case 'movement': case 'supply': case 'supplyMovement': case 'removeSupply':
    case 'tool': case 'removeTool': return tem(mods, 'Materiais');
    case 'investment': case 'investmentParcel': case 'removeInvestment': return tem(mods, 'Investimentos');
    case 'company': case 'settings': return tem(mods, 'Configurações');
    case 'entity':
      if (cadastro === 'materials' || cadastro === 'printers') return tem(mods, 'Cadastros', 'Materiais');
      return tem(mods, 'Cadastros');
    default: return false;
  }
}

/**
 * O que a pessoa recebe do banco. Tira o que ela não pode ver:
 *  - recebimentos: só Financeiro
 *  - compras e contas a pagar: Financeiro ou Materiais (a aba Compras é de Materiais)
 *  - investimentos: só Investimentos
 *  - ferramentas: Materiais ou Investimentos
 * Pedidos, orçamentos e configurações ficam: a produção precisa deles para trabalhar
 * (as configurações são só lidas; mudar exige o módulo Configurações).
 */
export function filtrarEstado<T extends Record<string, unknown>>(estado: T, mods: readonly string[]): T {
  const e: Record<string, unknown> = { ...estado };
  if (!tem(mods, 'Financeiro')) e.payments = [];
  if (!tem(mods, 'Financeiro', 'Materiais')) e.purchases = [];
  if (!tem(mods, 'Investimentos')) e.investments = [];
  if (!tem(mods, 'Materiais', 'Investimentos')) e.tools = [];
  return e as T;
}
