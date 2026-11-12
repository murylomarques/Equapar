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

function numeroCelula(c: ExcelJS.Cell): { n: number; pct: boolean } | null {
  let v = c.value as ExcelJS.CellValue;
  if (v && typeof v === "object" && "result" in v) v = v.result as ExcelJS.CellValue;
  const pctFmt = /%/.test(c.numFmt ?? "");
  if (typeof v === "number") return { n: pctFmt ? v * 100 : v, pct: pctFmt };
  if (typeof v === "string") {
    const s = v.trim();
    const m = /^(-?[\d.]*\d(?:,\d+)?)\s*(%)?$/.exec(s.replace(/^R\$\s*/i, ""));
    if (!m) return null;
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? { n, pct: !!m[2] } : null;
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
      const nums = celulas.map(numeroCelula).filter((x): x is { n: number; pct: boolean } => !!x);

      for (const [re, m] of TITULOS) if (re.test(desc) && desc.length < 90) modulo = m;
      if (/quantidade de (postos|empregados)|n[ºo°] de postos/i.test(desc) && nums.length) {
        quantidade = Math.max(1, Math.round(nums[nums.length - 1].n));
        return;
      }
      if (!desc || !nums.length || IGNORAR.test(desc)) return;
      if (TITULOS.some(([re]) => re.test(desc)) && desc.length < 90) return;
      // primeira coluna costuma ser o código do item ("A", "B", "2.1"): ignora números em células de texto curto
      if (!modulo) {
        naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: fmt(nums[nums.length - 1].n), motivo: "Linha antes do primeiro módulo" });
        return;
      }
      const m = moduloDaLinha(desc, modulo);
      const pct = nums.find((x) => x.pct);
      const valor = [...nums].reverse().find((x) => !x.pct);
      const ehSalario = m === "M1" && /sal[aá]rio[- ]base|sal[aá]rio normativo|piso/i.test(desc) && !linhas.some((l) => l.salarioBase);
      let linha: LinhaPlanilha;
      if (pct && !ehSalario) {
        linha = { id: novoId(), modulo: m, descricao: desc, tipo: "PERCENTUAL", base: m === "M6_TRIBUTOS" ? "POR_DENTRO" : basePadrao(m), valor: fmt(pct.n) };
      } else if (valor) {
        if (m === "M6_TRIBUTOS") {
          naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: fmt(valor.n), motivo: "Tributo sem alíquota (%): informe a alíquota" });
          return;
        }
        linha = { id: novoId(), modulo: m, descricao: desc, tipo: "VALOR", valor: fmt(valor.n), salarioBase: ehSalario || undefined };
      } else return;
      if (m === "M1" && !ehSalario && linha.tipo === "VALOR" && /sal[aá]rio/i.test(desc) && linhas.some((l) => l.salarioBase)) {
        naoLidas.push({ id: novoId("n"), posto: ws.name, texto: desc, numero: linha.valor, motivo: "Segundo salário no mesmo posto: confira" });
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
          naoLidas.push({ id: novoId("n"), posto: ws.name, texto: primeira.descricao, numero: primeira.valor, motivo: "Marcada como salário base por ser a primeira linha do Módulo 1: confira" });
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
          naoLidas.push({ id: novoId("n"), posto: p.nome, texto: `${x.descricao} (p. ${x.pagina})`, numero: x.valor, motivo: ok ? "Leitura com baixa confiança" : "Número ilegível" });
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
  if (l.observacoes) naoLidas.push({ id: novoId("n"), posto: "—", texto: l.observacoes, numero: null, motivo: "Observação da leitura automática" });
  return { planilha: { tipos }, lidas, naoLidas };
}
