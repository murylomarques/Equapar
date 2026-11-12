/**
 * Regras do pedido que não dependem de banco nem de sessão (testáveis em unidade).
 * As ações de servidor em app/app/pedidos/acoes.ts usam estas funções.
 */
import { Prisma, type Pedido } from "@prisma/client";
import type { PlanilhaCustos, LinhaPlanilha } from "./calculo/tipos";
import crypto from "node:crypto";
import { validarPlanilha, VERSAO_REGRA } from "./calculo/motor";
import { calcularPedido, situacaoChecklist } from "./pedido";

type PedidoBase = {
  planilhaAgora: unknown;
  passoAtual: number;
  memoriaAprovadaEm: Date | null;
  estado: string;
};

/**
 * C1. Trocar a planilha atual (envio de arquivo ou modelo em branco).
 * Se já existe planilha nova (passo 3), ela é refeita a partir da atual no passo 2:
 * apaga a planilha nova e os totais gravados, desfaz a aprovação e volta ao passo 2.
 * `precisaConfirmar` diz se a tela tem de pedir confirmação antes.
 */
export function aoTrocarPlanilhaAtual(p: PedidoBase): { precisaConfirmar: boolean; data: Prisma.PedidoUpdateInput } {
  const temNova = p.planilhaAgora !== null && p.planilhaAgora !== undefined;
  if (!temNova) return { precisaConfirmar: false, data: {} };
  return {
    precisaConfirmar: true,
    data: {
      planilhaAgora: Prisma.DbNull,
      diferencaMensal: null,
      diferencaRetroativa: null,
      passoAtual: Math.min(p.passoAtual, 2),
      ...dadosInvalidarAprovacao(p),
    },
  };
}

/** Campos gravados ao desfazer a aprovação (servem tanto no update "checked" quanto no "unchecked" do Prisma). */
export type DadosAprovacaoDesfeita = { memoriaAprovadaEm?: null; memoriaAprovadaPor?: null; estado?: "EM_ANALISE"; geradoEm?: null };

/** C2. Campos que desfazem a aprovação da memória (vazio se não havia aprovação nem pedido gerado). */
export function dadosInvalidarAprovacao(p: Pick<PedidoBase, "memoriaAprovadaEm" | "estado">): DadosAprovacaoDesfeita {
  const data: DadosAprovacaoDesfeita = {};
  if (p.memoriaAprovadaEm) Object.assign(data, { memoriaAprovadaEm: null, memoriaAprovadaPor: null });
  if (p.estado === "CALCULO_VALIDADO") Object.assign(data, { estado: "EM_ANALISE", geradoEm: null });
  return data;
}

// ---------------------------------------------------------------------------
// C3. Pendências para gerar o pedido (uma regra só para todos os passos)
// ---------------------------------------------------------------------------

export type Pendencia = { passo: 1 | 2 | 3 | 4 | 5; mensagem: string };

/** Linhas da planilha nova mudadas à mão (valor, tipo ou base) sem a fonte (cláusula). */
export function linhasSemFonte(antes: PlanilhaCustos, agora: PlanilhaCustos): LinhaPlanilha[] {
  return agora.tipos.flatMap((t) => {
    const ta = antes.tipos.find((x) => x.id === t.id);
    return t.linhas.filter((l) => {
      const la = ta?.linhas.find((x) => x.id === l.id);
      const mudou = !la || la.valor !== l.valor || la.tipo !== l.tipo || la.base !== l.base;
      return mudou && !l.fonte?.trim();
    });
  });
}

type PedidoPend = Pick<
  Pedido,
  "gatilho" | "convencaoId" | "dataBase" | "dataDeposito" | "descricaoGatilho" | "planilhaAntes" | "planilhaAgora" | "dataReferencia" | "checklist" | "memoriaAprovadaEm"
> & { hashCalculo?: string | null };

/**
 * Tudo o que impede gerar o pedido, em ordem de passo. `ate` limita aos passos já percorridos
 * (o passo 3 só confere 1 a 3; gerar confere tudo, inclusive a aprovação da memória).
 */
export function pendenciasParaGerar(p: PedidoPend, documentos: { tipo: string }[], ate: 3 | 4 | 5 = 5): Pendencia[] {
  const r: Pendencia[] = [];
  const conv = p.gatilho !== "OUTRO_CUSTO";
  if (!p.dataBase) r.push({ passo: 1, mensagem: "Falta a data-base." });
  if (conv && !p.convencaoId) r.push({ passo: 1, mensagem: "Falta escolher a convenção." });
  if (conv && !p.dataDeposito) r.push({ passo: 1, mensagem: "Falta a data do depósito da convenção." });
  if (!conv && !p.descricaoGatilho) r.push({ passo: 1, mensagem: "Falta descrever qual custo mudou." });

  const antes = p.planilhaAntes as unknown as PlanilhaCustos | null;
  const agora = p.planilhaAgora as unknown as PlanilhaCustos | null;
  if (!antes) r.push({ passo: 2, mensagem: "Falta a planilha atual." });
  else {
    const e = validarPlanilha(antes);
    if (e.length) r.push({ passo: 2, mensagem: `Planilha atual: ${e[0]}` });
  }
  if (antes && !agora) r.push({ passo: 3, mensagem: "Falta a planilha nova." });
  if (antes && agora) {
    const calc = calcularPedido(p);
    const c = calc.comparacao;
    if (c?.erros.length) r.push({ passo: 3, mensagem: c.erros[0] });
    else if (c && Number(c.diferencaMensal) <= 0) r.push({ passo: 3, mensagem: "A planilha nova não aumenta o valor mensal." });
    const sem = linhasSemFonte(antes, agora);
    if (sem.length)
      r.push({
        passo: 3,
        mensagem: `Falta a fonte (cláusula da convenção) de: ${sem
          .slice(0, 5)
          .map((l) => l.descricao || "linha sem nome")
          .join(", ")}${sem.length > 5 ? ` e mais ${sem.length - 5}` : ""}.`,
      });
  }
  if (ate >= 4) {
    const faltam = situacaoChecklist(p, documentos).filter((i) => i.situacao === "FALTA");
    if (faltam.length) r.push({ passo: 4, mensagem: `Falta: ${faltam.map((f) => f.nome.toLowerCase()).join("; ")}.` });
  }
  if (ate >= 5 && !aprovacaoValida({ ...p, hashCalculo: p.hashCalculo ?? null }))
    r.push({ passo: 5, mensagem: p.memoriaAprovadaEm ? "A base do cálculo mudou depois da aprovação. A memória precisa ser aprovada de novo." : "A memória de cálculo precisa ser aprovada por Contador ou Dono." });
  return r.filter((x) => x.passo <= ate);
}

/** C3. Totais gravados no pedido (listas e painéis) sempre iguais aos do documento. */
export function totaisGravados(p: Pick<Pedido, "planilhaAntes" | "planilhaAgora" | "dataBase" | "dataReferencia">) {
  const calc = calcularPedido(p);
  const ok = calc.comparacao && !calc.comparacao.erros.length;
  return {
    diferencaMensal: ok ? calc.comparacao!.diferencaMensal : null,
    diferencaRetroativa: ok ? (calc.retroativo?.total ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// C2.3. Assinatura da base do cálculo aprovada
// ---------------------------------------------------------------------------

/** JSON com chaves em ordem: o mesmo conteúdo gera sempre o mesmo texto. */
function jsonCanonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${jsonCanonico(o[k])}`)
    .join(",")}}`;
}

type BaseCalculo = Pick<Pedido, "planilhaAntes" | "planilhaAgora" | "dataBase" | "dataReferencia" | "gatilho">;

/** SHA-256 de {planilhas, data-base, data de referência, gatilho, versão da regra}. */
export function hashCalculo(p: BaseCalculo): string {
  const base = { planilhaAntes: p.planilhaAntes, planilhaAgora: p.planilhaAgora, dataBase: p.dataBase, dataReferencia: p.dataReferencia, gatilho: p.gatilho, versaoRegra: VERSAO_REGRA };
  return crypto.createHash("sha256").update(jsonCanonico(base)).digest("hex");
}

/**
 * A memória conta como aprovada só se a base do cálculo é a mesma da aprovação.
 * Aprovações anteriores à assinatura (hashCalculo vazio) continuam valendo.
 */
export function aprovacaoValida(p: BaseCalculo & Pick<Pedido, "memoriaAprovadaEm" | "hashCalculo">): boolean {
  return !!p.memoriaAprovadaEm && (!p.hashCalculo || p.hashCalculo === hashCalculo(p));
}
