/**
 * Fase 1 (4.4). Métricas do painel interno (só para o dono). Funções puras sobre dados já agregados;
 * a página busca no banco. Nenhum dado pessoal: só contagens, valores e datas.
 */
import Decimal from "decimal.js";

const mes = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Valor recuperado no prazo por mês (a métrica principal): soma das diferenças deferidas de pedidos
 * protocolados até o fim da vigência do contrato, agrupada pelo mês do deferimento.
 */
export function recuperadoNoPrazoPorMes(
  pedidos: { valorDeferido: Decimal.Value | null; deferidoEm: Date | null; protocoloData: Date | null; fimVigencia: Date }[],
): { mes: string; valor: string }[] {
  const porMes = new Map<string, Decimal>();
  for (const p of pedidos) {
    if (!p.valorDeferido || !p.deferidoEm || !p.protocoloData || p.protocoloData > p.fimVigencia) continue;
    const m = mes(p.deferidoEm);
    porMes.set(m, (porMes.get(m) ?? new Decimal(0)).plus(p.valorDeferido));
  }
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ mes: m, valor: v.toFixed(2) }));
}

/**
 * Retenção de receita de um mês para o seguinte, a partir das faturas por conta.
 * Bruta: o que as contas do mês anterior pagam agora, sem contar aumento (no máximo o valor anterior).
 * Líquida: o que as contas do mês anterior pagam agora, com aumento. Contas novas não entram.
 */
export function retencao(faturas: { contaId: string; referencia: string; valor: Decimal.Value }[], mesAnterior: string, mesAtual: string) {
  const soma = (ref: string) => {
    const m = new Map<string, Decimal>();
    for (const f of faturas) if (f.referencia === ref) m.set(f.contaId, (m.get(f.contaId) ?? new Decimal(0)).plus(f.valor));
    return m;
  };
  const antes = soma(mesAnterior);
  const agora = soma(mesAtual);
  const base = [...antes.values()].reduce((s, v) => s.plus(v), new Decimal(0));
  if (base.isZero()) return { bruta: null, liquida: null };
  let bruta = new Decimal(0);
  let liquida = new Decimal(0);
  for (const [conta, v] of antes) {
    const atual = agora.get(conta) ?? new Decimal(0);
    bruta = bruta.plus(Decimal.min(atual, v));
    liquida = liquida.plus(atual);
  }
  return { bruta: bruta.div(base).times(100).toDecimalPlaces(1).toNumber(), liquida: liquida.div(base).times(100).toDecimalPlaces(1).toNumber() };
}

/** Mediana, em dias, entre iniciar o pedido e gerar os documentos. */
export function medianaDiasMontagem(pedidos: { criadoEm: Date; geradoEm: Date | null }[]): number | null {
  const d = pedidos
    .filter((p) => p.geradoEm)
    .map((p) => (p.geradoEm!.getTime() - p.criadoEm.getTime()) / 86_400_000)
    .sort((a, b) => a - b);
  if (!d.length) return null;
  const meio = Math.floor(d.length / 2);
  const m = d.length % 2 ? d[meio] : (d[meio - 1] + d[meio]) / 2;
  return Math.round(m * 10) / 10;
}

/** Quem vê o painel: e-mails em PAINEL_EMAILS (separados por vírgula). */
export function podeVerPainel(email: string): boolean {
  const lista = (process.env.PAINEL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
