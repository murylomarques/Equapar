/**
 * Relatórios da conta, sem banco (as telas e os PDFs carregam os dados e chamam estas funções):
 * - "Resumo para o sócio": o que vence, o que está em andamento, o deferido não recebido e quanto vale 1% de reajuste;
 * - "Relatório do ano": pedidos montados, valor pedido, deferido, faturado e recebido, por contrato;
 * - "Caso pronto": texto curto de um pedido recebido, anônimo por padrão.
 * Regra: nenhum número é inventado. Tudo sai do que a pessoa registrou; estimativas vêm marcadas como tal.
 */
import Decimal from "decimal.js";
import { aReceber } from "./a-receber";
import { data } from "./datas";
import { brl } from "./calculo/motor";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const r2 = (v: Decimal.Value) => new D(v).toDecimalPlaces(2, D.ROUND_HALF_UP);
type Num = Decimal.Value | { toString(): string } | null | undefined;
const num = (v: Num) => (v == null ? null : new D(v.toString()));
const soma = (vs: Num[]) => r2(vs.reduce<Decimal>((s, v) => (v == null ? s : s.plus(v.toString())), new D(0))).toFixed(2);

// ---------------------------------------------------------------------------
// Valor mensal de referência e "cada 1% de reajuste"
// ---------------------------------------------------------------------------

/** Meses de vigência (fim inclusive): 01/01 a 31/12 = 12; 15/03 a 14/03 do ano seguinte = 12. Mínimo 1. */
export function mesesDeVigencia(inicio: Date, fim: Date) {
  const depois = new Date(fim.getTime() + 86_400_000);
  const diasNoMes = new Date(Date.UTC(depois.getUTCFullYear(), depois.getUTCMonth() + 1, 0)).getUTCDate();
  const meses =
    (depois.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (depois.getUTCMonth() - inicio.getUTCMonth()) + (depois.getUTCDate() - inicio.getUTCDate()) / diasNoMes;
  return Math.max(1, Math.round(meses));
}

export type ReferenciaMensal = {
  /** valor mensal usado na conta (2 casas) */
  valor: string;
  origem: "contrato" | "historico" | "global";
  /** só quando a origem é o valor global */
  meses?: number;
  /** valor mensal × 1% (estimativa, não promessa) */
  umPorCento: string;
};

/**
 * Valor mensal atual do contrato: o valor mensal cadastrado; sem ele, o último valor registrado no histórico
 * de valores (apostilamentos) até hoje; sem os dois, o valor global ÷ meses de vigência. Sem nada, null.
 */
export function valorMensalReferencia(
  c: { valorMensal: Num; valorGlobal: Num; vigenciaInicio: Date; vigenciaFim: Date },
  historico: { valorNovo: Num; aplicavelEm: Date }[] = [],
  hoje = new Date(),
): ReferenciaMensal | null {
  const comUm = (valor: Decimal, origem: ReferenciaMensal["origem"], meses?: number): ReferenciaMensal => ({
    valor: r2(valor).toFixed(2),
    origem,
    ...(meses ? { meses } : {}),
    umPorCento: r2(r2(valor).times("0.01")).toFixed(2),
  });
  const mensal = num(c.valorMensal);
  if (mensal && mensal.gt(0)) return comUm(mensal, "contrato");
  const ultimo = historico.filter((h) => h.aplicavelEm <= hoje && num(h.valorNovo)?.gt(0)).sort((a, b) => b.aplicavelEm.getTime() - a.aplicavelEm.getTime())[0];
  if (ultimo) return comUm(num(ultimo.valorNovo)!, "historico");
  const global = num(c.valorGlobal);
  if (global && global.gt(0)) {
    const meses = mesesDeVigencia(c.vigenciaInicio, c.vigenciaFim);
    return comUm(global.div(meses), "global", meses);
  }
  return null;
}

export function origemDoValor(r: ReferenciaMensal) {
  if (r.origem === "contrato") return "valor mensal cadastrado";
  if (r.origem === "historico") return "último valor mensal registrado";
  return `valor global ÷ ${r.meses} meses de vigência`;
}

// ---------------------------------------------------------------------------
// Resumo para o sócio
// ---------------------------------------------------------------------------

export const ESTADOS_EM_ANDAMENTO = ["EM_ANALISE", "CALCULO_VALIDADO", "PROTOCOLADO", "DEFERIDO", "FATURADO"] as const;

type PedidoResumo = {
  estado: string;
  diferencaMensal: Num;
  diferencaRetroativa: Num;
  retroativoAprovado: Num;
  valorDeferido: Num;
  notasFiscais: { id: string; valor: Num; canceladaEm?: Date | null }[];
  baixas: { notaFiscalId: string; valor: Num; canceladaEm?: Date | null }[];
};

/** Pedidos em andamento por situação (quantidade, diferença mensal e retroativo pedidos) e o deferido ainda não recebido. */
export function pedidosEmAndamento(pedidos: PedidoResumo[]) {
  const porSituacao = ESTADOS_EM_ANDAMENTO.map((estado) => {
    const ps = pedidos.filter((p) => p.estado === estado);
    return { estado, quantidade: ps.length, diferencaMensal: soma(ps.map((p) => p.diferencaMensal)), retroativo: soma(ps.map((p) => p.diferencaRetroativa)) };
  }).filter((s) => s.quantidade > 0);
  // o mesmo saldo da tela A receber (lib/a-receber): aprovado menos o recebido em notas e baixas válidas
  const { itens } = aReceber(pedidos.map((p) => ({ ...p, notasFiscais: p.notasFiscais.map((n) => ({ ...n, valor: (n.valor ?? 0).toString() })), baixas: p.baixas.map((b) => ({ ...b, valor: (b.valor ?? 0).toString() })) })));
  return { porSituacao, deferidoNaoRecebido: soma(itens.map((i) => i.saldo)), pedidosAReceber: itens.length };
}

// ---------------------------------------------------------------------------
// Relatório do ano
// ---------------------------------------------------------------------------

export type PedidoDoAno = {
  contrato: { id: string; numero: string; orgao: string };
  geradoEm: Date | null;
  diferencaMensal: Num;
  diferencaRetroativa: Num;
  deferidoEm: Date | null;
  retroativoAprovado: Num;
  valorDeferido: Num;
  mensalAprovado: Num;
  mensalVigenteAnterior: Num;
  recebidoEm: Date | null;
  valorRecebido: Num;
  notasFiscais: { id: string; valor: Num; emitidaEm: Date; canceladaEm?: Date | null }[];
  baixas: { notaFiscalId: string; valor: Num; recebidoEm: Date; canceladaEm?: Date | null }[];
};

export type LinhaAno = {
  contratoId: string;
  numero: string;
  orgao: string;
  montados: number;
  mensalPedido: string;
  retroativoPedido: string;
  deferidos: number;
  mensalDeferido: string;
  retroativoDeferido: string;
  faturado: string;
  recebido: string;
};

const noAno = (d: Date | null | undefined, ano: number) => !!d && d.getUTCFullYear() === ano;

/**
 * Por contrato, no ano: pedidos montados (gerados) e o que pediram (diferença mensal e retroativo, em colunas
 * separadas); deferidos no ano (aumento mensal aprovado e retroativo aprovado); notas válidas emitidas no ano;
 * recebimentos válidos no ano (pedido antigo sem baixas registradas usa o valor recebido gravado no pedido).
 */
export function relatorioDoAno(pedidos: PedidoDoAno[], ano: number) {
  const porContrato = new Map<string, PedidoDoAno[]>();
  for (const p of pedidos) porContrato.set(p.contrato.id, [...(porContrato.get(p.contrato.id) ?? []), p]);
  const linhas: LinhaAno[] = [];
  for (const ps of porContrato.values()) {
    const c = ps[0].contrato;
    const montados = ps.filter((p) => noAno(p.geradoEm, ano));
    const deferidos = ps.filter((p) => noAno(p.deferidoEm, ano));
    const notas = ps.flatMap((p) => p.notasFiscais.filter((n) => !n.canceladaEm && noAno(n.emitidaEm, ano)));
    const recebidos = ps.flatMap((p) => {
      if (!p.baixas.length) return noAno(p.recebidoEm, ano) ? [p.valorRecebido] : [];
      const validas = new Set(p.notasFiscais.filter((n) => !n.canceladaEm).map((n) => n.id));
      return p.baixas.filter((b) => !b.canceladaEm && validas.has(b.notaFiscalId) && noAno(b.recebidoEm, ano)).map((b) => b.valor);
    });
    const linha: LinhaAno = {
      contratoId: c.id,
      numero: c.numero,
      orgao: c.orgao,
      montados: montados.length,
      mensalPedido: soma(montados.map((p) => p.diferencaMensal)),
      retroativoPedido: soma(montados.map((p) => p.diferencaRetroativa)),
      deferidos: deferidos.length,
      mensalDeferido: soma(
        deferidos.map((p) => {
          const aprovado = num(p.mensalAprovado);
          const anterior = num(p.mensalVigenteAnterior);
          return aprovado && anterior ? D.max(0, aprovado.minus(anterior)) : null;
        }),
      ),
      retroativoDeferido: soma(deferidos.map((p) => p.retroativoAprovado ?? p.valorDeferido)),
      faturado: soma(notas.map((n) => n.valor)),
      recebido: soma(recebidos),
    };
    const vazia = !linha.montados && !linha.deferidos && linha.faturado === "0.00" && linha.recebido === "0.00";
    if (!vazia) linhas.push(linha);
  }
  linhas.sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  const total = {
    montados: linhas.reduce((s, l) => s + l.montados, 0),
    mensalPedido: soma(linhas.map((l) => l.mensalPedido)),
    retroativoPedido: soma(linhas.map((l) => l.retroativoPedido)),
    deferidos: linhas.reduce((s, l) => s + l.deferidos, 0),
    mensalDeferido: soma(linhas.map((l) => l.mensalDeferido)),
    retroativoDeferido: soma(linhas.map((l) => l.retroativoDeferido)),
    faturado: soma(linhas.map((l) => l.faturado)),
    recebido: soma(linhas.map((l) => l.recebido)),
  };
  return { ano, linhas, total };
}

/** Anos com algum movimento (para o seletor), do mais recente; inclui o ano atual. */
export function anosComMovimento(pedidos: PedidoDoAno[], hoje = new Date()) {
  const anos = new Set<number>([hoje.getUTCFullYear()]);
  for (const p of pedidos) {
    for (const d of [p.geradoEm, p.deferidoEm, p.recebidoEm, ...p.notasFiscais.map((n) => n.emitidaEm), ...p.baixas.map((b) => b.recebidoEm)]) if (d) anos.add(d.getUTCFullYear());
  }
  return [...anos].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Caso pronto
// ---------------------------------------------------------------------------

const ESFERA: Record<string, string> = { F: "órgão federal", E: "órgão estadual", M: "órgão municipal", D: "órgão distrital" };

export type DadosCaso = {
  contrato: { numero: string; orgao: string; esfera: string | null; uf: string | null; objeto: string };
  categoria: string | null;
  protocoloData: Date | null;
  deferidoEm: Date | null;
  recebidoEm: Date | null;
  recebido: string;
  diferencaMensalPedida: Num;
  mensalAprovado: Num;
  mensalVigenteAnterior: Num;
  retroativoAprovado: Num;
};

const brlTexto = (v: Num) => brl((v ?? 0).toString());
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

/** Texto do caso (Markdown simples). Anônimo por padrão: tipo de órgão, UF e categoria, sem nome nem número. */
export function textoCasoPronto(d: DadosCaso, opcoes: { identificado?: boolean } = {}) {
  const tipoOrgao = (d.contrato.esfera && ESFERA[d.contrato.esfera]) || "órgão público";
  const onde = opcoes.identificado ? `no contrato ${d.contrato.numero} com ${d.contrato.orgao}` : `num contrato com ${tipoOrgao}${d.contrato.uf ? ` (${d.contrato.uf})` : ""}`;
  const categoria = d.categoria ? d.categoria.toLowerCase() : "serviços com mão de obra dedicada";
  const titulo = `${brlTexto(d.recebido)} recebidos ${onde}`;
  const linhas: string[] = [`# ${titulo}`, "", `Repactuação de ${categoria}${opcoes.identificado ? "" : ", com o órgão e a empresa anonimizados"}.`, "", "## Números"];
  const aprovado = num(d.mensalAprovado);
  const anterior = num(d.mensalVigenteAnterior);
  if (aprovado && anterior && aprovado.gt(anterior)) linhas.push(`- Aumento mensal aprovado: ${brlTexto(aprovado.minus(anterior))} por mês (de ${brlTexto(anterior)} para ${brlTexto(aprovado)}).`);
  else if (num(d.diferencaMensalPedida)) linhas.push(`- Diferença mensal pedida: ${brlTexto(d.diferencaMensalPedida)} por mês.`);
  if (num(d.retroativoAprovado)) linhas.push(`- Retroativo aprovado: ${brlTexto(d.retroativoAprovado)}.`);
  linhas.push(`- Recebido: ${brlTexto(d.recebido)}.`);
  linhas.push("", "## Linha do tempo");
  if (d.protocoloData) linhas.push(`- Protocolo: ${data(d.protocoloData)}.`);
  if (d.deferidoEm) linhas.push(`- Deferimento: ${data(d.deferidoEm)}${d.protocoloData ? ` (${dias(d.protocoloData, d.deferidoEm)} dias depois do protocolo)` : ""}.`);
  if (d.recebidoEm) linhas.push(`- Recebimento: ${data(d.recebidoEm)}${d.deferidoEm ? ` (${dias(d.deferidoEm, d.recebidoEm)} dias depois do deferimento)` : ""}.`);
  linhas.push(
    "",
    "---",
    "Valores registrados pela empresa no sistema Equapar. Rascunho para aprovação: publicar exige a autorização assinada do cliente (modelo de autorização de publicação de caso). Não inclua dados de empregados.",
  );
  return { titulo, markdown: linhas.join("\n") };
}
