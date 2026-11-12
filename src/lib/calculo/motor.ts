import Decimal from "decimal.js";
import {
  BASES_PERMITIDAS,
  MODULOS,
  NOME_BASE,
  type BaseId,
  type LinhaCalculada,
  type LinhaPlanilha,
  type ModuloId,
  type PlanilhaCustos,
  type PostoCalculado,
  type ResultadoPlanilha,
  type TipoPosto,
} from "./tipos";

/**
 * Motor determinístico. Regras fixas e explícitas:
 * - Aritmética decimal exata (decimal.js), nunca ponto flutuante.
 * - Cada linha é arredondada a 2 casas (meio para cima) antes de entrar em somas,
 *   como numa planilha preenchida à mão. O total é a soma das linhas arredondadas.
 * - Percentual = valor ÷ 100 × base.
 * - Tributos "por dentro": preço = base ÷ (1 − Σ alíquotas); cada tributo = preço × alíquota.
 *   A diferença de centavos do arredondamento fica na última linha de tributo, para que
 *   base + tributos = preço.
 * A IA nunca produz número final: só sugere entradas que o usuário confirma.
 */

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;

export const VERSAO_REGRA = "IN05-2017-AnexoVII-D/v1";

export function dec(v: string | number | null | undefined): Dec {
  if (v === null || v === undefined || v === "") return new D(0);
  const s = typeof v === "number" ? String(v) : v.trim().replace(/\s/g, "");
  return new D(s);
}

export function r2(v: Dec): Dec {
  return v.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export function brl(v: Dec | string | number): string {
  const n = typeof v === "object" ? v : dec(v);
  const neg = n.isNegative();
  const [int, frac] = r2(n.abs()).toFixed(2).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "−" : ""}R$ ${intFmt},${frac}`;
}

export function pct(v: Dec | string): string {
  const n = typeof v === "object" ? v : dec(v);
  // até 4 casas, sem zeros sobrando, mínimo 2
  let s = n.toDecimalPlaces(4).toFixed(4).replace(/0{1,2}$/, "");
  s = s.replace(".", ",");
  return `${s}%`;
}

function validarNumero(txt: string): boolean {
  return /^-?\d+(\.\d+)?$/.test((txt ?? "").trim());
}

export function validarPlanilha(p: PlanilhaCustos): string[] {
  const erros: string[] = [];
  if (!p || !Array.isArray(p.tipos) || p.tipos.length === 0) {
    erros.push("A planilha não tem nenhum tipo de posto.");
    return erros;
  }
  for (const t of p.tipos) {
    const pref = `Posto "${t.nome || "sem nome"}"`;
    if (!Number.isInteger(t.quantidade) || t.quantidade < 0) erros.push(`${pref}: a quantidade de postos precisa ser um número inteiro.`);
    const salarios = t.linhas.filter((l) => l.salarioBase);
    if (salarios.length !== 1) erros.push(`${pref}: marque exatamente uma linha do Módulo 1 como salário base.`);
    if (salarios[0] && (salarios[0].modulo !== "M1" || salarios[0].tipo !== "VALOR"))
      erros.push(`${pref}: o salário base precisa ser um valor em reais no Módulo 1.`);
    let somaAliq = new D(0);
    for (const l of t.linhas) {
      const nome = `${pref}, linha "${l.descricao || l.id}"`;
      if (!validarNumero(l.valor)) {
        erros.push(`${nome}: "${l.valor}" não é um número. Use ponto para decimais, sem R$ ou %.`);
        continue;
      }
      if (l.tipo === "PERCENTUAL") {
        if (!l.base) erros.push(`${nome}: informe sobre qual base o percentual incide.`);
        else if (!BASES_PERMITIDAS[l.modulo].includes(l.base))
          erros.push(`${nome}: a base "${NOME_BASE[l.base]}" não pode ser usada em ${l.modulo}, porque ainda não foi calculada nesse ponto.`);
        if (l.modulo === "M6_TRIBUTOS") somaAliq = somaAliq.plus(dec(l.valor));
      } else if (l.modulo === "M6_TRIBUTOS") {
        erros.push(`${nome}: tributos são informados como alíquota (%), calculada por dentro.`);
      }
    }
    if (somaAliq.gte(100)) erros.push(`${pref}: a soma das alíquotas de tributos precisa ser menor que 100%.`);
  }
  return erros;
}

function calcularPosto(t: TipoPosto): PostoCalculado {
  const linhasPorModulo = (m: ModuloId) => t.linhas.filter((l) => l.modulo === m);
  const out: LinhaCalculada[] = [];
  const total: Record<string, Dec> = {};
  for (const m of MODULOS) total[m.id] = new D(0);

  const salarioLinha = t.linhas.find((l) => l.salarioBase);
  const salario = r2(dec(salarioLinha?.valor));

  const bases = (): Record<BaseId, Dec> => {
    const M1 = total.M1;
    const M1_M21 = M1.plus(total.M2_1);
    const M2 = total.M2_1.plus(total.M2_2).plus(total.M2_3);
    const M1_M3 = M1.plus(M2).plus(total.M3);
    const SUBTOTAL = M1_M3.plus(total.M4).plus(total.M5);
    const SUBTOTAL_CI = SUBTOTAL.plus(total.M6_CI);
    return { SALARIO_BASE: salario, M1, M1_M21, M1_M3, SUBTOTAL, SUBTOTAL_CI, POR_DENTRO: new D(0) };
  };

  const fazLinha = (l: LinhaPlanilha) => {
    if (l.tipo === "VALOR") {
      const v = r2(dec(l.valor));
      total[l.modulo] = total[l.modulo].plus(v);
      out.push({
        id: l.id,
        modulo: l.modulo,
        descricao: l.descricao,
        valor: v.toFixed(2),
        conta: `${brl(v)} informado${l.salarioBase ? " (salário base)" : ""}`,
        fonte: l.fonte,
      });
    } else {
      const base = l.base ?? "M1";
      const b = bases()[base];
      const p = dec(l.valor);
      const v = r2(p.div(100).times(b));
      total[l.modulo] = total[l.modulo].plus(v);
      out.push({
        id: l.id,
        modulo: l.modulo,
        descricao: l.descricao,
        valor: v.toFixed(2),
        conta: `${pct(p)} × ${brl(b)} (${NOME_BASE[base]}) = ${brl(v)}`,
        fonte: l.fonte,
      });
    }
  };

  // Módulo 1: primeiro valores (salário e adicionais em R$), depois percentuais sobre o salário base
  const m1 = linhasPorModulo("M1");
  m1.filter((l) => l.tipo === "VALOR").forEach(fazLinha);
  m1.filter((l) => l.tipo === "PERCENTUAL").forEach(fazLinha);
  for (const m of ["M2_1", "M2_2", "M2_3", "M3", "M4", "M5", "M6_CI", "M6_LUCRO"] as ModuloId[]) {
    linhasPorModulo(m).forEach(fazLinha);
  }

  // Tributos por dentro
  const tributos = linhasPorModulo("M6_TRIBUTOS");
  const baseTrib = bases().SUBTOTAL_CI.plus(total.M6_LUCRO);
  const somaAliq = tributos.reduce((s, l) => s.plus(dec(l.valor)), new D(0));
  if (tributos.length > 0) {
    const preco = r2(baseTrib.div(new D(1).minus(somaAliq.div(100))));
    const totalTrib = preco.minus(baseTrib);
    let acumulado = new D(0);
    tributos.forEach((l, i) => {
      const ultima = i === tributos.length - 1;
      const aliq = dec(l.valor);
      const v = ultima ? totalTrib.minus(acumulado) : r2(preco.times(aliq.div(100)));
      acumulado = acumulado.plus(v);
      out.push({
        id: l.id,
        modulo: "M6_TRIBUTOS",
        descricao: l.descricao,
        valor: v.toFixed(2),
        conta:
          `${pct(aliq)} × ${brl(preco)} (preço por dentro: ${brl(baseTrib)} ÷ (1 − ${pct(somaAliq)})) = ${brl(v)}` +
          (ultima && tributos.length > 1 ? " · inclui o ajuste de centavos do arredondamento" : ""),
        fonte: l.fonte,
      });
    });
    total.M6_TRIBUTOS = totalTrib;
  }

  const valorPorPosto = MODULOS.reduce((s, m) => s.plus(total[m.id]), new D(0));
  const totaisModulo = Object.fromEntries(MODULOS.map((m) => [m.id, total[m.id].toFixed(2)])) as Record<ModuloId, string>;
  // mantém a ordem original das linhas na saída, para a memória acompanhar a planilha
  const ordem = new Map(t.linhas.map((l, i) => [l.id, i]));
  out.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));

  return {
    id: t.id,
    nome: t.nome,
    quantidade: t.quantidade,
    linhas: out,
    totaisModulo,
    valorPorPosto: valorPorPosto.toFixed(2),
    valorMensal: r2(valorPorPosto.times(t.quantidade)).toFixed(2),
  };
}

export function calcularPlanilha(p: PlanilhaCustos): ResultadoPlanilha {
  const erros = validarPlanilha(p);
  if (erros.length) return { postos: [], valorMensal: "0.00", erros };
  const postos = p.tipos.map(calcularPosto);
  const valorMensal = postos.reduce((s, x) => s.plus(dec(x.valorMensal)), new D(0));
  return { postos, valorMensal: valorMensal.toFixed(2), erros: [] };
}

// ---------------------------------------------------------------------------
// Comparação Antes × Agora
// ---------------------------------------------------------------------------

export interface LinhaComparada {
  postoId: string;
  postoNome: string;
  id: string;
  modulo: ModuloId;
  descricao: string;
  antes: string;
  agora: string;
  variacao: string;
  variacaoPct: string | null;
  contaAntes: string;
  contaAgora: string;
  fonte?: string;
}

export interface Comparacao {
  linhas: LinhaComparada[];
  postos: { id: string; nome: string; quantidadeAntes: number; quantidadeAgora: number; porPostoAntes: string; porPostoAgora: string; mensalAntes: string; mensalAgora: string }[];
  mensalAntes: string;
  mensalAgora: string;
  diferencaMensal: string;
  variacaoPct: string | null;
  erros: string[];
}

export function compararPlanilhas(antes: PlanilhaCustos, agora: PlanilhaCustos): Comparacao {
  const ra = calcularPlanilha(antes);
  const rn = calcularPlanilha(agora);
  const erros = [...ra.erros.map((e) => `Planilha atual: ${e}`), ...rn.erros.map((e) => `Planilha nova: ${e}`)];
  if (erros.length)
    return { linhas: [], postos: [], mensalAntes: "0.00", mensalAgora: "0.00", diferencaMensal: "0.00", variacaoPct: null, erros };

  const linhas: LinhaComparada[] = [];
  const postos: Comparacao["postos"] = [];
  const ids = new Set([...ra.postos.map((p) => p.id), ...rn.postos.map((p) => p.id)]);
  for (const pid of ids) {
    const pa = ra.postos.find((p) => p.id === pid);
    const pn = rn.postos.find((p) => p.id === pid);
    const nome = pn?.nome ?? pa?.nome ?? pid;
    postos.push({
      id: pid,
      nome,
      quantidadeAntes: pa?.quantidade ?? 0,
      quantidadeAgora: pn?.quantidade ?? 0,
      porPostoAntes: pa?.valorPorPosto ?? "0.00",
      porPostoAgora: pn?.valorPorPosto ?? "0.00",
      mensalAntes: pa?.valorMensal ?? "0.00",
      mensalAgora: pn?.valorMensal ?? "0.00",
    });
    const lids: string[] = [];
    for (const l of [...(pa?.linhas ?? []), ...(pn?.linhas ?? [])]) if (!lids.includes(l.id)) lids.push(l.id);
    for (const lid of lids) {
      const la = pa?.linhas.find((l) => l.id === lid);
      const ln = pn?.linhas.find((l) => l.id === lid);
      const a = dec(la?.valor ?? "0");
      const n = dec(ln?.valor ?? "0");
      const v = n.minus(a);
      linhas.push({
        postoId: pid,
        postoNome: nome,
        id: lid,
        modulo: (ln ?? la)!.modulo,
        descricao: (ln ?? la)!.descricao,
        antes: a.toFixed(2),
        agora: n.toFixed(2),
        variacao: v.toFixed(2),
        variacaoPct: a.isZero() ? null : r2(v.div(a).times(100)).toFixed(2),
        contaAntes: la?.conta ?? "linha inexistente na planilha atual",
        contaAgora: ln?.conta ?? "linha removida na planilha nova",
        fonte: ln?.fonte ?? la?.fonte,
      });
    }
  }
  const ma = dec(ra.valorMensal);
  const mn = dec(rn.valorMensal);
  return {
    linhas,
    postos,
    mensalAntes: ma.toFixed(2),
    mensalAgora: mn.toFixed(2),
    diferencaMensal: mn.minus(ma).toFixed(2),
    variacaoPct: ma.isZero() ? null : r2(mn.minus(ma).div(ma).times(100)).toFixed(2),
    erros: [],
  };
}

// ---------------------------------------------------------------------------
// Diferença retroativa desde a data-base
// ---------------------------------------------------------------------------

export interface MesRetroativo {
  competencia: string; // "2026-01"
  dias: number;
  diasNoMes: number;
  valor: string;
  conta: string;
}

export interface Retroativo {
  meses: MesRetroativo[];
  total: string;
}

function diasNoMes(ano: number, mes0: number) {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}

/**
 * Diferença devida de `inicio` (data-base, inclusive) até `fim` (inclusive).
 * Mês cheio = diferença mensal. Mês parcial = diferença × dias ÷ dias do mês (pro rata por dia corrido).
 * Datas em UTC, sem horário.
 */
export function calcularRetroativo(diferencaMensal: string, inicio: Date, fim: Date): Retroativo {
  const dif = dec(diferencaMensal);
  const meses: MesRetroativo[] = [];
  const i = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
  const f = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()));
  if (f < i) return { meses: [], total: "0.00" };
  let ano = i.getUTCFullYear();
  let mes = i.getUTCMonth();
  let total = new D(0);
  while (ano < f.getUTCFullYear() || (ano === f.getUTCFullYear() && mes <= f.getUTCMonth())) {
    const dim = diasNoMes(ano, mes);
    const primeiro = ano === i.getUTCFullYear() && mes === i.getUTCMonth() ? i.getUTCDate() : 1;
    const ultimo = ano === f.getUTCFullYear() && mes === f.getUTCMonth() ? f.getUTCDate() : dim;
    const dias = ultimo - primeiro + 1;
    const cheio = dias === dim;
    const valor = cheio ? r2(dif) : r2(dif.times(dias).div(dim));
    total = total.plus(valor);
    const comp = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    meses.push({
      competencia: comp,
      dias,
      diasNoMes: dim,
      valor: valor.toFixed(2),
      conta: cheio ? `mês cheio: ${brl(dif)}` : `${brl(dif)} × ${dias} ÷ ${dim} dias = ${brl(valor)}`,
    });
    mes++;
    if (mes > 11) {
      mes = 0;
      ano++;
    }
  }
  return { meses, total: total.toFixed(2) };
}
