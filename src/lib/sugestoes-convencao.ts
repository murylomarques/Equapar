/**
 * 5.5: leitura da convenção com IA. Funções puras: o que vai para a IA, o que volta dela (filtrado) e como
 * as linhas CONFIRMADAS pela pessoa entram na planilha nova. A IA nunca é a fonte do número final: só entra o
 * valor que a pessoa confirmou (e pode corrigir), com a cláusula e a página da convenção como fonte.
 */
import type { PlanilhaCustos } from "./calculo/tipos";
import type { LeituraConvencao, LinhaParaConvencao } from "./ia";

export interface ItemSugestao {
  postoId: string;
  posto: string;
  linhaId: string;
  descricao: string;
  tipo: "VALOR" | "PERCENTUAL";
  valorAtual: string;
  valorNovo: string;
  clausula: string;
  pagina: number;
  trecho: string;
  confianca: "alta" | "baixa";
}

export interface SugestoesConvencao {
  documentoId: string;
  lidoEm: string;
  observacoes: string;
  itens: ItemSugestao[];
}

/** Linhas que a convenção pode afetar: tudo fora do Módulo 6 (custos indiretos, lucro e tributos não vêm da convenção). */
export function linhasParaConvencao(p: PlanilhaCustos): LinhaParaConvencao[] {
  return p.tipos.flatMap((t) =>
    t.linhas
      .filter((l) => !l.modulo.startsWith("M6"))
      .map((l) => ({ postoId: t.id, posto: t.nome, linhaId: l.id, modulo: l.modulo, descricao: l.descricao, tipo: l.tipo, valorAtual: l.valor })),
  );
}

/** Número como a IA devolveu ("1.820,00", "1820.00", "8,33") para o formato da planilha ("1820.00"). Inválido: null. */
export function normalizarNumero(v: string): string | null {
  let s = v.trim().replace(/^R\$\s*/, "").replace(/%$/, "").trim();
  if (/,\d{1,4}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s).toFixed(2);
}

/** Fica só o que aponta para uma linha que existe e tem número válido; uma sugestão por linha. */
export function filtrarSugestoes(leitura: LeituraConvencao, linhas: LinhaParaConvencao[]): ItemSugestao[] {
  const vistos = new Set<string>();
  const out: ItemSugestao[] = [];
  for (const s of leitura.sugestoes) {
    const l = linhas.find((x) => x.postoId === s.postoId && x.linhaId === s.linhaId);
    const valorNovo = normalizarNumero(s.valorNovo);
    const chave = `${s.postoId}:${s.linhaId}`;
    if (!l || valorNovo == null || vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ ...l, valorNovo, clausula: s.clausula.trim(), pagina: s.pagina, trecho: s.trecho.slice(0, 300), confianca: s.confianca });
  }
  return out;
}

/** Fonte da linha confirmada: "Cláusula 4ª, p. 3" (a memória transforma em link para a página do PDF). */
export function fonteDaSugestao(clausula: string, pagina: number) {
  const c = /cl[aá]usula/i.test(clausula) ? clausula : `Cláusula ${clausula}`;
  return `${c}, p. ${pagina}`.slice(0, 300);
}

/** Página citada na fonte ("..., p. 3"), para o link da memória. */
export function paginaDaFonte(fonte: string | undefined | null): number | null {
  const m = /\bp\.\s*(\d{1,4})\b/.exec(fonte ?? "");
  return m ? Number(m[1]) : null;
}

/** Aplica só as linhas confirmadas. Devolve a planilha nova (sem mexer na original) e quantas linhas mudaram. */
export function aplicarConfirmadas(p: PlanilhaCustos, confirmadas: { postoId: string; linhaId: string; valor: string; fonte: string }[]) {
  let n = 0;
  const nova: PlanilhaCustos = {
    tipos: p.tipos.map((t) => ({
      ...t,
      linhas: t.linhas.map((l) => {
        const c = confirmadas.find((x) => x.postoId === t.id && x.linhaId === l.id);
        if (!c) return { ...l };
        n++;
        return { ...l, valor: c.valor, fonte: c.fonte };
      }),
    })),
  };
  return { planilha: nova, aplicadas: n };
}
