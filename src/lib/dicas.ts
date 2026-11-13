/**
 * 5.4: primeiro pedido guiado. Uma dica curta por passo, só no primeiro pedido da conta
 * (nenhum pedido gerado ainda). Dispensada, não volta mais (Conta.dicasDispensadas).
 */
export const DICAS_PASSO: Record<number, string> = {
  1: "Escolha o motivo e a convenção nova. A data-base é quando a convenção começa a valer: a diferença conta a partir dela.",
  2: "Envie a planilha da proposta ou do último apostilamento. Sem o arquivo, comece do modelo e digite os números da proposta.",
  3: "Troque só os números que a convenção mudou e escreva a cláusula em cada linha alterada. A memória ao lado mostra cada conta.",
  4: "Anexe a convenção nova e a planilha atual. Sem eles, o órgão costuma devolver o pedido.",
  5: "Confira a memória e peça a aprovação do Contador ou do Dono. Depois, gere o ofício, a planilha e a memória.",
};

export function dicasDispensadas(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Mostra a dica do passo? Só no primeiro pedido da conta e se ela não foi dispensada. */
export function mostrarDica(passo: number, pedidosGerados: number, dispensadas: unknown) {
  return pedidosGerados === 0 && !!DICAS_PASSO[passo] && !dicasDispensadas(dispensadas).includes(`passo${passo}`);
}
