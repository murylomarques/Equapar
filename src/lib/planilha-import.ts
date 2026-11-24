import "server-only";
import ExcelJS from "exceljs";
import type { LinhaPlanilha, ModuloId, PlanilhaCustos, TipoPosto } from "./calculo/tipos";
import { MODULOS } from "./calculo/tipos";
import { novoId } from "./calculo/modelo";
import type { LeituraIa } from "./ia";

/**
 * Leitura de planilha de custos em Excel (modelo IN 05/2017).
 * Heurística conservadora: identifica o módulo pelos títulos ("Módulo 1", "Submódulo 2.2"...),
 * lê percentual quando a linha tem um, senão o valor em reais. O que não der para enquadrar
 * vai para "linhas não lidas" e o usuário confere no passo 2. Nenhum número é inventado.
 */

export interface LinhaNaoLida {
  id: string;
  posto: string;
  texto: string;
  numero: string | null;
  motivo: string;
  aba?: string;
  linha?: number;
  celula?: string;
  conteudoOriginal?: string;
  tipoOriginal?: string;
  impeditiva?: boolean;
  status?: "PENDENTE" | "CORRIGIDA" | "JUSTIFICADA";
  decisao?: string;
}

export interface Importacao {
  planilha: PlanilhaCustos;
  lidas: number;
  naoLidas: LinhaNaoLida[];
}

const TITULOS: [RegExp, ModuloId][] = [
  [/subm[oó]dulo\s*2\.1|13.{0,3}sal[aá]rio.*f[eé]rias/i, "M2_1"],
  [/subm[oó]dulo\s*2\.2|gps.*fgts|encargos previdenci/i, "M2_2"],
  [/subm[oó]dulo\s*2\.3|benef[ií]cios mensais/i, "M2_3"],
  [/m[oó]dulo\s*1\b|composi[cç][aã]o da remunera/i, "M1"],
  [/m[oó]dulo\s*3\b|provis[aã]o para rescis/i, "M3"],
  [/m[oó]dulo\s*4\b|reposi[cç][aã]o do profissional/i, "M4"],
  [/m[oó]dulo\s*5\b|insumos/i, "M5"],
  [/m[oó]dulo\s*6\b|custos indiretos,? tributos e lucro/i, "M6_CI"],
];

const IGNORAR = /^(total|subtotal|valor total|soma)\b|^total d/i;

function textoCelula(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return textoCelula(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

type NumeroLido = {
  n: number;
  pct: boolean;
  origem: NonNullable<LinhaPlanilha["origem"]>;
};

function origem(c: ExcelJS.Cell, tipo: NonNullable<LinhaPlanilha["origem"]>["tipo"], conteudo: string, interpretacao: string): NumeroLido["origem"] {
  return { aba: c.worksheet.name, linha: c.fullAddress.row, celula: c.address, conteudo, tipo, interpretacao };
}

/**
 * Texto monetário conservador. O ponto com exatamente duas casas é decimal
 * (1800.00), ponto+vírgula segue pt-BR (1.800,00) e 1.800 isolado fica ambíguo.
 */
function numeroTexto(s0: string): { n: number; pct: boolean; ambiguo?: string } | null {
  const bruto = s0.trim();
  const pct = /%\s*$/.test(bruto);
  let s = bruto.replace(/^R\$\s*/i, "").replace(/%\s*$/, "").replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const virgula = s.lastIndexOf(",");
  const ponto = s.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    if (virgula < ponto) return { n: NaN, pct, ambiguo: "Separadores em ordem incomum; confirme o valor" };
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (virgula >= 0) {
    const casas = s.length - virgula - 1;
    if (casas === 3 && /^-?\d{1,3},\d{3}$/.test(s)) return { n: NaN, pct, ambiguo: "Vírgula com três casas pode ser decimal ou milhar" };
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ponto >= 0) {
    const casas = s.length - ponto - 1;
    if (casas === 3 && /^-?\d{1,3}\.\d{3}$/.test(s)) return { n: NaN, pct, ambiguo: "Ponto com três casas pode ser decimal ou milhar" };
    if ((s.match(/\./g) ?? []).length > 1) return { n: NaN, pct, ambiguo: "Mais de um ponto sem separador decimal explícito" };
  }
  const n = Number(s);
  return Number.isFinite(n) ? { n, pct } : null;
}

function numeroCelula(c: ExcelJS.Cell): NumeroLido | { pendencia: string; origem: NumeroLido["origem"] } | null {
  let v = c.value as ExcelJS.CellValue;
  let formula = false;
  if (v && typeof v === "object" && "error" in v)
    return { pendencia: `Célula com erro ${String(v.error)}`, origem: origem(c, "TEXTO", String(v.error), "sem valor utilizável") };
  if (v && typeof v === "object" && "formula" in v) {
    formula = true;
    if (!("result" in v) || v.result == null)
      return { pendencia: "Fórmula sem resultado salvo utilizável", origem: origem(c, "TEXTO", `=${v.formula}`, "requer recálculo ou correção") };
    v = v.result as ExcelJS.CellValue;
  }
  const pctFmt = /%/.test(c.numFmt ?? "");
  const moedaFmt = /R\$|\[\$-pt-BR\]|#.*0\.00/.test(c.numFmt ?? "");
  if (typeof v === "number") {
    const n = pctFmt ? v * 100 : v;
    const tipo = formula ? "FORMULA_COM_RESULTADO" : pctFmt ? "PERCENTUAL" : moedaFmt ? "MOEDA" : "NUMERO";
    return { n, pct: pctFmt, origem: origem(c, tipo, formula ? `${String((c.value as { formula?: string }).formula)} = ${String(v)}` : String(v), pctFmt ? `${fmt(n)}%` : `R$ ${fmt(n)}`) };
  }
  if (typeof v === "string") {
    const lido = numeroTexto(v);
    if (!lido) return null;
    if (lido.ambiguo) return { pendencia: lido.ambiguo, origem: origem(c, "TEXTO", v, "confirmação explícita necessária") };
    return { n: lido.n, pct: lido.pct || pctFmt, origem: origem(c, formula ? "FORMULA_COM_RESULTADO" : lido.pct || pctFmt ? "PERCENTUAL" : /^R\$/i.test(v.trim()) ? "MOEDA" : "TEXTO", v, `${lido.pct || pctFmt ? fmt(lido.n) + "%" : "R$ " + fmt(lido.n)}`) };
  }
  return null;
}

function moduloDaLinha(desc: string, atual: ModuloId): ModuloId {
  if (atual === "M6_CI" || atual === "M6_LUCRO" || atual === "M6_TRIBUTOS") {
    if (/lucro/i.test(desc)) return "M6_LUCRO";
    if (/pis|cofins|iss|tribut|cbs|ibs|irpj|csll/i.test(desc)) return "M6_TRIBUTOS";
    if (/indiret|administra/i.test(desc)) return "M6_CI";
  }
  return atual;
}

function basePadrao(m: ModuloId) {
  return MODULOS.find((x) => x.id === m)!.basePadrao;
}

function fmt(n: number) {
  return String(Math.round(n * 1e6) / 1e6);
}

export async function importarExcel(buf: Buffer): Promise<Importacao> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tipos: TipoPosto[] = [];
  const naoLidas: LinhaNaoLida[] = [];
  let lidas = 0;

  wb.eachSheet((ws) => {
    let modulo: ModuloId | null = null;
    const linhas: LinhaPlanilha[] = [];
    let quantidade = 1;
    ws.eachRow((row) => {
      const celulas: ExcelJS.Cell[] = [];
      row.eachCell({ includeEmpty: false }, (c) => celulas.push(c));
      const textos = celulas.map((c) => textoCelula(c.value)).filter((t) => t && !/^[\d.,%R$\s-]+$/.test(t));
      const desc = textos.sort((a, b) => b.length - a.length)[0]?.trim() ?? "";
      const leituras = celulas.map(numeroCelula);
      const nums = leituras.filter((x): x is NumeroLido => !!x && "n" in x);
      const pendenciasCelula = leituras.filter((x): x is { pendencia: string; origem: NumeroLido["origem"] } => !!x && "pendencia" in x);

      for (const [re, m] of TITULOS) if (re.test(desc) && desc.length < 90) modulo = m;
      if (/quantidade de (postos|empregados)|n[ºo°] de postos/i.test(desc) && nums.length) {
        quantidade = Math.max(1, Math.round(nums[nums.length - 1].n));
        return;
      }
      if (!desc || IGNORAR.test(desc)) return;
      if (TITULOS.some(([re]) => re.test(desc)) && desc.length < 90) return;
      if (pendenciasCelula.length) {
        for (const x of pendenciasCelula)
          naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: null, motivo: x.pendencia, aba: ws.name, linha: row.number, celula: x.origem.celula, conteudoOriginal: x.origem.conteudo, tipoOriginal: x.origem.tipo, impeditiva: true, status: "PENDENTE" });
        return;
      }
      if (!nums.length) {
        if (modulo) naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: null, motivo: "Linha relevante sem valor utilizável", aba: ws.name, linha: row.number, conteudoOriginal: celulas.map((c) => textoCelula(c.value)).join(" | "), tipoOriginal: "SEM_VALOR", impeditiva: true, status: "PENDENTE" });
        return;
      }
      // primeira coluna costuma ser o código do item ("A", "B", "2.1"): ignora números em células de texto curto
      if (!modulo) {
        const o = nums[nums.length - 1].origem;
        naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: fmt(nums[nums.length - 1].n), motivo: "Linha antes do primeiro módulo", aba: ws.name, linha: row.number, celula: o.celula, conteudoOriginal: o.conteudo, tipoOriginal: o.tipo, impeditiva: true, status: "PENDENTE" });
        return;
      }
      const m = moduloDaLinha(desc, modulo);
      const pct = nums.find((x) => x.pct);
      const valor = [...nums].reverse().find((x) => !x.pct);
      const ehSalario = m === "M1" && /sal[aá]rio[- ]base|sal[aá]rio normativo|piso/i.test(desc) && !linhas.some((l) => l.salarioBase);
      let linha: LinhaPlanilha;
      if (pct && !ehSalario) {
        linha = { id: novoId(), modulo: m, descricao: desc, tipo: "PERCENTUAL", base: m === "M6_TRIBUTOS" ? "POR_DENTRO" : basePadrao(m), valor: fmt(pct.n), origem: pct.origem };
      } else if (valor) {
        if (m === "M6_TRIBUTOS") {
          naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: fmt(valor.n), motivo: "Tributo sem alíquota (%): informe a alíquota", aba: ws.name, linha: row.number, celula: valor.origem.celula, conteudoOriginal: valor.origem.conteudo, tipoOriginal: valor.origem.tipo, impeditiva: true, status: "PENDENTE" });
          return;
        }
        linha = { id: novoId(), modulo: m, descricao: desc, tipo: "VALOR", valor: fmt(valor.n), salarioBase: ehSalario || undefined, origem: valor.origem };
      } else return;
      if (m === "M1" && !ehSalario && linha.tipo === "VALOR" && /sal[aá]rio/i.test(desc) && linhas.some((l) => l.salarioBase)) {
        naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: linha.valor, motivo: "Segundo salário no mesmo posto: confira", aba: ws.name, linha: row.number, impeditiva: true, status: "PENDENTE" });
        return;
      }
      linhas.push(linha);
      lidas++;
    });
    if (linhas.length) {
      if (!linhas.some((l) => l.salarioBase)) {
        const primeira = linhas.find((l) => l.modulo === "M1" && l.tipo === "VALOR");
        if (primeira) {
          primeira.salarioBase = true;
          naoLidas.push({ id: novoId("n"), posto: ws.name, texto: primeira.descricao, numero: primeira.valor, motivo: "Marcada como salário base por ser a primeira linha do Módulo 1: confira", aba: ws.name, linha: primeira.origem?.linha, celula: primeira.origem?.celula, conteudoOriginal: primeira.origem?.conteudo, tipoOriginal: primeira.origem?.tipo, impeditiva: true, status: "PENDENTE" });
        }
      }
      tipos.push({ id: novoId("p"), nome: ws.name.slice(0, 60), quantidade, linhas });
    }
  });

  return { planilha: { tipos }, lidas, naoLidas };
}

export function deLeituraIa(l: LeituraIa): Importacao {
  const naoLidas: LinhaNaoLida[] = [];
  let lidas = 0;
  const tipos: TipoPosto[] = l.postos.map((p) => ({
    id: novoId("p"),
    nome: p.nome,
    quantidade: Math.max(0, p.quantidade),
    linhas: p.linhas
      .filter((x) => {
        const ok = /^-?\d+(\.\d+)?$/.test(x.valor.trim());
        if (!ok || x.confianca === "baixa") {
          naoLidas.push({ id: novoId("n"), posto: p.nome, texto: `${x.descricao} (p. ${x.pagina})`, numero: x.valor, motivo: ok ? "Leitura com baixa confiança" : "Número ilegível", aba: `PDF p. ${x.pagina}`, impeditiva: true, status: "PENDENTE" });
        }
        return ok;
      })
      .map((x) => {
        lidas++;
        return {
          id: novoId(),
          modulo: x.modulo,
          descricao: x.descricao,
          tipo: x.modulo === "M6_TRIBUTOS" ? "PERCENTUAL" : x.tipo,
          base: x.tipo === "PERCENTUAL" || x.modulo === "M6_TRIBUTOS" ? (x.modulo === "M6_TRIBUTOS" ? "POR_DENTRO" : basePadrao(x.modulo)) : undefined,
          valor: x.valor.trim(),
          salarioBase: x.salarioBase || undefined,
          fonte: `Planilha da proposta, p. ${x.pagina}`,
        } satisfies LinhaPlanilha;
      }),
  }));
  if (l.observacoes) naoLidas.push({ id: novoId("n"), posto: "—", texto: l.observacoes, numero: null, motivo: "Observação da leitura automática", impeditiva: false, status: "JUSTIFICADA", decisao: "Observação informativa da leitura automática." });
  return { planilha: { tipos }, lidas, naoLidas };
}
