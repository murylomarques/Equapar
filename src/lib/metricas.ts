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

// ---------------------------------------------------------------------------
// 5.4: custo de aquisição e margem (números que o dono informa por mês)
// ---------------------------------------------------------------------------

/** Contas cujo primeiro pagamento caiu no mês: as novas pagantes. */
export function novasPagantes(faturas: { contaId: string; pagaEm: Date | null }[], m: string): number {
  const primeiro = new Map<string, string>();
  for (const f of faturas) {
    if (!f.pagaEm) continue;
    const x = mes(f.pagaEm);
    const atual = primeiro.get(f.contaId);
    if (!atual || x < atual) primeiro.set(f.contaId, x);
  }
  return [...primeiro.values()].filter((x) => x === m).length;
}

/** Custo de aquisição por conta nova pagante. Sem o custo informado ou sem conta nova, não há número. */
export function custoPorAquisicao(custo: Decimal.Value | null, novas: number): string | null {
  if (custo == null || novas === 0) return null;
  return new Decimal(custo).div(novas).toFixed(2);
}

/** Margem bruta em reais do mês: receita paga × margem informada. */
export function margemEmReais(receita: Decimal.Value, margemPct: Decimal.Value | null): string | null {
  if (margemPct == null) return null;
  return new Decimal(receita).times(margemPct).div(100).toFixed(2);
}

// ---------------------------------------------------------------------------
// 5.5: minutos de trabalho humano por cliente e a pesquisa de Sean Ellis
// ---------------------------------------------------------------------------

export const TIPOS_TEMPO = { COLETA: "Coleta", CALCULO: "Cálculo", REVISAO: "Revisão", RETRABALHO: "Retrabalho", SUPORTE: "Suporte" } as const;

/** Por plano: clientes com registro, minutos no mês, minutos por cliente e por tipo. Meta do dossiê: até 49 min/mês no plano de R$ 497. */
export function tempoPorPlano(registros: { contaId: string; tipo: string; minutos: number; data: Date }[], planoDe: Map<string, string>, m: string) {
  const out = new Map<string, { plano: string; contas: Set<string>; minutos: number; porTipo: Record<string, number> }>();
  for (const r of registros) {
    if (mes(r.data) !== m) continue;
    const plano = planoDe.get(r.contaId) ?? "?";
    const g = out.get(plano) ?? { plano, contas: new Set<string>(), minutos: 0, porTipo: {} };
    g.contas.add(r.contaId);
    g.minutos += r.minutos;
    g.porTipo[r.tipo] = (g.porTipo[r.tipo] ?? 0) + r.minutos;
    out.set(plano, g);
  }
  return [...out.values()]
    .map((g) => ({ plano: g.plano, clientes: g.contas.size, minutos: g.minutos, porCliente: Math.round(g.minutos / g.contas.size), porTipo: g.porTipo }))
    .sort((a, b) => a.plano.localeCompare(b.plano));
}

export const RESPOSTAS_PESQUISA = {
  MUITO_DECEPCIONADO: "Muito decepcionado",
  POUCO_DECEPCIONADO: "Um pouco decepcionado",
  NAO_DECEPCIONADO: "Não ficaria decepcionado",
  NAO_USO_MAIS: "Não uso mais a Equapar",
} as const;

/** Sean Ellis: % de "muito decepcionados" entre quem ainda usa. Meta do dossiê: 40% ou mais. */
export function resultadoSeanEllis(respostas: { resposta: string }[]) {
  const usam = respostas.filter((r) => r.resposta !== "NAO_USO_MAIS");
  const muito = usam.filter((r) => r.resposta === "MUITO_DECEPCIONADO").length;
  return { respostas: respostas.length, consideradas: usam.length, muito, pct: usam.length ? Math.round((muito / usam.length) * 1000) / 10 : null };
}

/** A pesquisa aparece uma vez para cada conta ativa há mais de 30 dias (nem demonstração, nem já respondida/dispensada). */
export function mostrarPesquisa(conta: { criadoEm: Date; demo: boolean; pesquisaDispensadaEm: Date | null }, agora = new Date()) {
  return !conta.demo && !conta.pesquisaDispensadaEm && agora.getTime() - conta.criadoEm.getTime() > 30 * 86_400_000;
}
