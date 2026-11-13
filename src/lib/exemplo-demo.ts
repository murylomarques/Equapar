/**
 * A4: um único conjunto de dados FICTÍCIOS para a prévia da landing e para a demonstração (seed).
 * Mudou aqui, muda nos dois lugares; os números da prévia e da demonstração são os mesmos.
 */
export const EXEMPLO = {
  usuario: "Juliana",
  pedir: { numero: "45/2025", orgao: "Prefeitura Municipal de Exemplo", diasAteProrrogacao: 18 },
  protocolado: { numero: "12/2024", orgao: "Tribunal Regional Exemplo", diasDesdeProtocolo: 21 },
  deferido: { numero: "07/2025", orgao: "Universidade Federal Exemplo", valor: "31540.20" },
  /** Contratos com prazo nos próximos 30 dias na demonstração: o 45/2025 (prorrogação) e o 12/2024 (resposta do órgão). */
  prazos30: 2,
} as const;

/** "R$ 31,5 mil", no mesmo formato do resumo do produto. */
export function valorResumoExemplo() {
  return `R$ ${(Number(EXEMPLO.deferido.valor) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}
