/**
 * Prévia do retroativo no passo 3 (quadro "Memória de cálculo" ao lado da planilha).
 * Lê as opções do formulário "Regra da diferença retroativa" do mesmo jeito que o servidor lê ao concluir
 * o passo e calcula com retroativoDoPedido (lib/pedido.ts), a mesma conta do passo 5, da memória e dos
 * documentos. Sem dependência do servidor: roda no navegador.
 */
import { lerDinheiro } from "./datas";
import { retroativoDoPedido, type RetroativoDoPedido } from "./pedido";
import type { CompetenciaRetroativo } from "./retroativo-competencias";

export type ContarAte = "DATA_INFORMADA" | "DATA_PROTOCOLO" | "DATA_APOSTILAMENTO";
export type MesIncompletoOpcao = "DIAS_CORRIDOS" | "MES_30_DIAS";

/** Opções do retroativo gravadas no pedido (datas em AAAA-MM-DD, para passar do servidor ao navegador). */
export type OpcoesRetroativo = {
  retroContarAte: ContarAte;
  retroMesIncompleto: MesIncompletoOpcao;
  retroCompararMes: boolean;
  valoresJaPagos: string | null;
  retroativoCompetencias: CompetenciaRetroativo[];
  protocoloData: string | null;
  apostiladoEm: string | null;
  gatilho: string;
  jornadaInicioEfeitos: string | null;
};

const CONTAR_ATE: ContarAte[] = ["DATA_INFORMADA", "DATA_PROTOCOLO", "DATA_APOSTILAMENTO"];
const MES: MesIncompletoOpcao[] = ["DIAS_CORRIDOS", "MES_30_DIAS"];

/** Competências do formulário (JSON do campo oculto). Lança erro se alguma linha não tiver valor em reais. */
export function lerCompetenciasRetroativo(textoJson: string): CompetenciaRetroativo[] {
  const recebido = JSON.parse(textoJson || "[]") as unknown;
  if (!Array.isArray(recebido)) throw new Error("Competências inválidas.");
  return recebido.map((linha) => {
    const item = linha as Record<string, unknown>;
    const diferencaMensal = lerDinheiro(String(item.diferencaMensal ?? ""));
    if (!diferencaMensal) throw new Error("Competências inválidas.");
    return {
      competencia: String(item.competencia ?? ""),
      diferencaMensal,
      dias: Number(item.dias),
      divisor: Number(item.divisor),
      base: String(item.base ?? "") || undefined,
      periodo: String(item.periodo ?? "") || undefined,
    };
  });
}

type LeitorForm = { get(nome: string): FormDataEntryValue | null; has(nome: string): boolean };

/**
 * Aplica o que está digitado no formulário sobre as opções gravadas. Campo ausente mantém o gravado;
 * campo inválido devolve `erro` (o servidor recusaria o passo com a mesma causa).
 */
export function opcoesDoFormulario(gravadas: OpcoesRetroativo, fd: LeitorForm): { opcoes: OpcoesRetroativo; erro?: string } {
  const o = { ...gravadas };
  const txt = (n: string) => (fd.get(n) ?? "").toString().trim();
  if (fd.has("retroContarAte")) o.retroContarAte = CONTAR_ATE.find((v) => v === txt("retroContarAte")) ?? gravadas.retroContarAte;
  if (fd.has("retroMesIncompleto")) o.retroMesIncompleto = MES.find((v) => v === txt("retroMesIncompleto")) ?? gravadas.retroMesIncompleto;
  if (fd.has("valoresJaPagos")) {
    const pago = txt("valoresJaPagos") ? lerDinheiro(txt("valoresJaPagos")) : "0";
    if (pago == null || Number(pago) < 0) return { opcoes: gravadas, erro: "Confira os valores já pagos." };
    o.valoresJaPagos = pago;
  }
  if (fd.has("retroativoCompetencias")) {
    try {
      o.retroativoCompetencias = lerCompetenciasRetroativo(txt("retroativoCompetencias"));
    } catch {
      return { opcoes: gravadas, erro: "Confira as competências do retroativo." };
    }
  }
  return { opcoes: o };
}

const dia = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

/** O retroativo da prévia: a mesma função do resultado oficial, com a data-base e a data informada no passo 3. */
export function previaRetroativo(opcoes: OpcoesRetroativo, diferencaMensal: string | null, dataBase: string | null, dataReferencia: string | null): RetroativoDoPedido {
  return retroativoDoPedido(
    {
      dataBase: dia(dataBase),
      dataReferencia: dia(dataReferencia),
      retroContarAte: opcoes.retroContarAte,
      retroMesIncompleto: opcoes.retroMesIncompleto,
      retroCompararMes: opcoes.retroCompararMes,
      valoresJaPagos: (opcoes.valoresJaPagos ?? "0") as never,
      retroativoCompetencias: opcoes.retroativoCompetencias as never,
      protocoloData: dia(opcoes.protocoloData),
      apostiladoEm: dia(opcoes.apostiladoEm),
      gatilho: opcoes.gatilho as never,
      jornadaInicioEfeitos: dia(opcoes.jornadaInicioEfeitos),
    },
    diferencaMensal,
  );
}
