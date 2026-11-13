/**
 * E3. Avaliação da leitura de convenção com IA contra um gabarito. Funções puras (o script
 * scripts/avaliar-ia-convencao.ts lê os PDFs, chama a IA e imprime o relatório).
 *
 * Regra para ligar a IA: o gabarito foi CONFERIDO por uma pessoa e NENHUM erro tem confiança "alta".
 */
import type { PlanilhaCustos } from "./calculo/tipos";
import type { LeituraConvencao } from "./ia";
import { normalizarNumero } from "./sugestoes-convencao";

export interface CampoGabarito {
  linha: string; // "posto:linha"
  valor: number | null; // null = a convenção não traz valor em reais para a linha (a IA deve omitir)
  unidade: string;
  condicao: string;
  clausula: string;
  pagina: string; // "2-3", "9-10 e 12-13", "7 e 12"
}
export interface ConvencaoGabarito {
  id: string;
  registro: string;
  arquivo: string;
  conferido: boolean;
  campos: Record<string, CampoGabarito>;
}

/** Posto de exemplo da avaliação: as linhas que as convenções costumam definir (valores atuais fictícios). */
export const POSTO_EXEMPLO: PlanilhaCustos = {
  tipos: [
    {
      id: "srv",
      nome: "Servente 44h",
      quantidade: 1,
      linhas: [
        { id: "sal", modulo: "M1", descricao: "Salário base (piso)", tipo: "VALOR", valor: "1700.00", salarioBase: true },
        { id: "ins", modulo: "M1", descricao: "Adicional de insalubridade", tipo: "VALOR", valor: "300.00" },
        { id: "alim", modulo: "M2_3", descricao: "Auxílio-alimentação", tipo: "VALOR", valor: "400.00" },
        { id: "vt", modulo: "M2_3", descricao: "Vale-transporte", tipo: "VALOR", valor: "200.00" },
        { id: "cesta", modulo: "M2_3", descricao: "Cesta básica", tipo: "VALOR", valor: "150.00" },
        { id: "saude", modulo: "M2_3", descricao: "Assistência à saúde", tipo: "VALOR", valor: "40.00" },
        { id: "seguro", modulo: "M2_3", descricao: "Seguro de vida", tipo: "VALOR", valor: "10.00" },
        { id: "uni", modulo: "M5", descricao: "Uniformes", tipo: "VALOR", valor: "25.00" },
        { id: "social", modulo: "M2_3", descricao: "Benefício social sindical", tipo: "VALOR", valor: "15.00" },
      ],
    },
    { id: "enc", nome: "Encarregado 44h", quantidade: 1, linhas: [{ id: "sal", modulo: "M1", descricao: "Salário base (piso)", tipo: "VALOR", valor: "2300.00", salarioBase: true }] },
  ],
};

/** "3ª e nota 1" → "3"; "Cláusula 12ª, § 2º" → "12" (o número da cláusula principal). */
export function numeroClausula(c: string) {
  return /(\d+)/.exec(c ?? "")?.[1] ?? null;
}

/** "2-3" → [2,3]; "9-10 e 12-13" → [9,10,12,13]; "7 e 12" → [7,12]. */
export function paginasDoGabarito(p: string): number[] {
  const out: number[] = [];
  for (const parte of (p ?? "").split(/\s*(?:e|,)\s*/)) {
    const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(parte.trim());
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
    else if (/^\d+$/.test(parte.trim())) out.push(Number(parte.trim()));
  }
  return out;
}

export type Resultado = "acerto" | "erro" | "omissao";
export interface ItemAvaliado {
  campo: string;
  linha: string;
  resultado: Resultado;
  motivo: string;
  confianca: "alta" | "baixa" | null;
  trecho: string | null;
}

/** Compara uma leitura com o gabarito de uma convenção. Unidade e condição: a leitura atual não as devolve (ver relatório). */
export function avaliarLeitura(g: ConvencaoGabarito, leitura: LeituraConvencao): ItemAvaliado[] {
  return Object.entries(g.campos).map(([campo, esperado]) => {
    const [postoId, linhaId] = esperado.linha.split(":");
    const s = leitura.sugestoes.find((x) => x.postoId === postoId && x.linhaId === linhaId);
    const base = { campo, linha: esperado.linha, confianca: s?.confianca ?? null, trecho: s?.trecho ?? null };
    if (esperado.valor == null)
      return s ? { ...base, resultado: "erro" as const, motivo: `sugeriu ${s.valorNovo}, mas a convenção não traz valor em reais (${esperado.condicao})` } : { ...base, resultado: "acerto" as const, motivo: "omitiu corretamente" };
    if (!s) return { ...base, resultado: "omissao" as const, motivo: `não sugeriu; esperado ${esperado.valor} (${esperado.unidade})` };
    const v = normalizarNumero(s.valorNovo);
    const problemas: string[] = [];
    if (v == null || Math.abs(Number(v) - esperado.valor) > 0.005) problemas.push(`valor ${s.valorNovo} ≠ ${esperado.valor}`);
    if (numeroClausula(s.clausula) !== numeroClausula(esperado.clausula)) problemas.push(`cláusula "${s.clausula}" ≠ "${esperado.clausula}"`);
    if (!paginasDoGabarito(esperado.pagina).includes(s.pagina)) problemas.push(`página ${s.pagina} fora de ${esperado.pagina}`);
    return problemas.length ? { ...base, resultado: "erro" as const, motivo: problemas.join("; ") } : { ...base, resultado: "acerto" as const, motivo: "valor, cláusula e página conferem" };
  });
}

export function resumo(itens: ItemAvaliado[], sugestoesBaixa: number) {
  const conta = (r: Resultado, c?: "alta" | "baixa") => itens.filter((i) => i.resultado === r && (c === undefined || i.confianca === c)).length;
  return {
    acertos: conta("acerto"),
    erros: conta("erro"),
    omissoes: conta("omissao"),
    paraConferenciaHumana: sugestoesBaixa,
    porConfianca: {
      alta: { acertos: conta("acerto", "alta"), erros: conta("erro", "alta") },
      baixa: { acertos: conta("acerto", "baixa"), erros: conta("erro", "baixa") },
    },
    errosComConfiancaAlta: conta("erro", "alta"),
  };
}

/** A IA pode ser ligada? Só com o gabarito conferido por uma pessoa e sem erro de confiança alta. */
export function podeLigar(conferido: boolean, errosComConfiancaAlta: number) {
  return conferido && errosComConfiancaAlta === 0;
}
