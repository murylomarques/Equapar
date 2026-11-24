/**
 * P0. Orçamento de IA. Nenhuma chamada paga acontece sem orçamento configurado, disponível e RESERVADO no servidor.
 *
 *  - Antes de cada tentativa: reserva o PIOR custo possível da operação (páginas × tokens por página + instruções,
 *    saída máxima, margem), numa transação com trava global. Duas reservas simultâneas nunca usam o mesmo saldo.
 *  - Depois: consolida o custo real pelos tokens que a API informou e libera a diferença.
 *  - Falha com resposta de erro da API: custo zero. Tempo esgotado ou conexão caída: custo incerto, conta o reservado.
 *  - Reserva esquecida (processo caiu): expira depois de alguns minutos contando o valor reservado (conservador).
 *
 * Todos os tetos vêm do ambiente e o padrão é ZERO: sem configuração explícita, a IA paga fica bloqueada.
 * Preços: https://platform.claude.com/docs/en/about-claude/pricing (consultado em 24/11/2026), em US$ por milhão de tokens.
 */
import Decimal from "decimal.js";
import { db } from "./db";
import type { PlanoId } from "./planos";

export type OperacaoIa = "LEITURA_PLANILHA" | "LEITURA_CONVENCAO" | "AVALIACAO";

type Preco = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
/** US$ por milhão de tokens. Haiku 5.5 tem preço maior acima de 100 mil tokens de entrada. */
export const PRECOS_USD_MTOK: Record<string, Preco & { acima100k?: Preco }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20, cacheLeitura: 0.2, cacheEscrita: 5 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, cacheLeitura: 0.1, cacheEscrita: 2.5 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5, cacheLeitura: 0.01, cacheEscrita: 0.125, acima100k: { entrada: 0.5, saida: 2.5, cacheLeitura: 0.05, cacheEscrita: 0.625 } },
};

const num = (v: string | undefined, padrao: number) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : padrao);

/** Configuração lida a cada chamada (permite desligar sem reiniciar em ambientes que recarregam o env). */
export function configIa() {
  return {
    desligada: process.env.IA_DESLIGADA === "true",
    modelo: process.env.IA_MODELO || "claude-opus-5-5",
    /** Teto do SaaS inteiro no mês (US$). Padrão 0 = nenhuma chamada. */
    globalUsdMes: num(process.env.IA_ORCAMENTO_GLOBAL_USD_MES, 0),
    /** Teto por conta no mês, por plano (US$). Grátis é sempre 0. */
    planoUsdMes: {
      GRATIS: 0,
      PILOTO: num(process.env.IA_ORCAMENTO_PILOTO_USD_MES, 0),
      CARTEIRA: num(process.env.IA_ORCAMENTO_CARTEIRA_USD_MES, 0),
      ASSESSORIA: num(process.env.IA_ORCAMENTO_ASSESSORIA_USD_MES, 0),
    } as Record<PlanoId, number>,
    /** Orçamento separado das avaliações internas (scripts do dono), dentro do teto global. */
    avaliacaoUsdMes: num(process.env.IA_ORCAMENTO_AVALIACAO_USD_MES, 0),
    usuarioPorDia: num(process.env.IA_LIMITE_USUARIO_DIA, 10),
    concorrenciaConta: num(process.env.IA_CONCORRENCIA_CONTA, 1),
    concorrenciaGlobal: num(process.env.IA_CONCORRENCIA_GLOBAL, 4),
    maxBytes: num(process.env.IA_MAX_MB, 10) * 1024 * 1024,
    maxPaginas: num(process.env.IA_MAX_PAGINAS, 40),
    maxSaida: num(process.env.IA_MAX_SAIDA, 16000),
    tentativas: Math.max(1, Math.min(3, num(process.env.IA_TENTATIVAS, 2))),
    /** Multiplicador de segurança sobre o pior caso estimado. */
    margem: Math.max(1, num(process.env.IA_MARGEM_RESERVA, 1.2)),
    /** Pior caso de tokens por página de PDF (texto + imagem da página). Medido em avaliação; conservador. */
    tokensPorPagina: num(process.env.IA_TOKENS_POR_PAGINA, 4000),
    reservaExpiraMin: num(process.env.IA_RESERVA_EXPIRA_MIN, 15),
  };
}

export function periodoDe(agora: Date) {
  return agora.toISOString().slice(0, 7);
}

/** Custo de uma chamada pelos tokens (entrada sem cache, saída, leitura e escrita de cache). */
export function custoUsd(modelo: string, u: { entrada: number; saida: number; cacheLeitura?: number; cacheEscrita?: number }): Decimal {
  const base = PRECOS_USD_MTOK[modelo];
  if (!base) throw new Error(`Modelo sem preço cadastrado: ${modelo}`);
  const totalEntrada = u.entrada + (u.cacheLeitura ?? 0) + (u.cacheEscrita ?? 0);
  const p = base.acima100k && totalEntrada > 100_000 ? base.acima100k : base;
  return new Decimal(u.entrada)
    .times(p.entrada)
    .plus(new Decimal(u.saida).times(p.saida))
    .plus(new Decimal(u.cacheLeitura ?? 0).times(p.cacheLeitura))
    .plus(new Decimal(u.cacheEscrita ?? 0).times(p.cacheEscrita))
    .div(1_000_000);
}

/** Pior custo de uma tentativa: todas as páginas no teto de tokens, instruções, saída máxima e margem. */
export function piorCustoUsd(modelo: string, o: { paginas: number; tokensExtras: number; maxSaida?: number; entradaExata?: number | null }, cfg = configIa()): Decimal {
  // com a contagem exata da API (gratuita), a entrada é conhecida; sem ela, estimativa pelo teto de tokens por página
  const entrada = o.entradaExata != null && o.entradaExata > 0 ? o.entradaExata + 500 : o.paginas * cfg.tokensPorPagina + o.tokensExtras + 2_000;
  return custoUsd(modelo, { entrada, saida: o.maxSaida ?? cfg.maxSaida }).times(cfg.margem).toDecimalPlaces(6, Decimal.ROUND_UP);
}

export type Bloqueio = { codigo: "DESLIGADA" | "PLANO" | "SEM_ORCAMENTO" | "CONTA_ESGOTADA" | "GLOBAL_ESGOTADO" | "OCUPADO" | "USUARIO_DIA" | "GRANDE_DEMAIS"; mensagem: string };

const ALTERNATIVA = " Você pode continuar enviando a planilha em Excel ou preenchendo as linhas à mão.";

/** Checagens que não dependem do saldo (feitas antes de qualquer trabalho). */
export function bloqueioPrevio(o: { plano: PlanoId | "INTERNO"; bytes: number; paginas: number }, cfg = configIa()): Bloqueio | null {
  if (cfg.desligada) return { codigo: "DESLIGADA", mensagem: "A leitura com IA está temporariamente desligada." + ALTERNATIVA };
  if (o.plano === "GRATIS") return { codigo: "PLANO", mensagem: "A leitura com IA não faz parte do plano Grátis." + ALTERNATIVA };
  const teto = o.plano === "INTERNO" ? cfg.avaliacaoUsdMes : cfg.planoUsdMes[o.plano];
  if (!(teto > 0) || !(cfg.globalUsdMes > 0)) return { codigo: "SEM_ORCAMENTO", mensagem: "A leitura com IA ainda não está liberada para este plano." + ALTERNATIVA };
  if (o.bytes > cfg.maxBytes || o.paginas > cfg.maxPaginas)
    return { codigo: "GRANDE_DEMAIS", mensagem: `O documento passa do limite da leitura automática (${cfg.maxPaginas} páginas, ${Math.round(cfg.maxBytes / 1024 / 1024)} MB). Envie só as páginas da planilha ou use o Excel.` };
  return null;
}

/** Soma do gasto (real quando já se sabe; reservado enquanto não) de um filtro. */
async function gasto(tx: Pick<typeof db, "$queryRaw">, periodo: string, contaId?: string): Promise<Decimal> {
  const r = contaId
    ? await tx.$queryRaw<{ s: string | null }[]>`SELECT SUM(COALESCE("custoRealUsd", "custoReservadoUsd"))::text AS s FROM "UsoIa" WHERE periodo = ${periodo} AND "contaId" = ${contaId}`
    : await tx.$queryRaw<{ s: string | null }[]>`SELECT SUM(COALESCE("custoRealUsd", "custoReservadoUsd"))::text AS s FROM "UsoIa" WHERE periodo = ${periodo}`;
  return new Decimal(r[0]?.s ?? 0);
}

export type Reserva = { id: string; custoReservadoUsd: Decimal };

/**
 * Reserva atômica: trava global (pg_advisory_xact_lock), confere tetos da conta, global, concorrência e limite
 * diário do usuário, e só então grava a reserva. Devolve o bloqueio quando não pode.
 */
export async function reservar(o: {
  contaId: string;
  usuarioId: string | null;
  plano: PlanoId | "INTERNO";
  operacao: OperacaoIa;
  modelo: string;
  bytes: number;
  paginas: number;
  tokensExtras: number;
  hashDocumento: string;
  tentativa: number;
  /** tokens de entrada contados pela API antes da chamada (quando disponível) */
  entradaExata?: number | null;
  agora?: Date;
}): Promise<Reserva | Bloqueio> {
  const cfg = configIa();
  const previo = bloqueioPrevio(o, cfg);
  if (previo) return previo;
  const agora = o.agora ?? new Date();
  const periodo = periodoDe(agora);
  const valor = piorCustoUsd(o.modelo, { paginas: o.paginas, tokensExtras: o.tokensExtras, entradaExata: o.entradaExata }, cfg);
  const tetoConta = new Decimal(o.plano === "INTERNO" ? cfg.avaliacaoUsdMes : cfg.planoUsdMes[o.plano]);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('equapar:ia-orcamento'))`;
    const [daConta, total] = await Promise.all([gasto(tx, periodo, o.contaId), gasto(tx, periodo)]);
    if (daConta.plus(valor).gt(tetoConta))
      return { codigo: "CONTA_ESGOTADA", mensagem: `A cota de leitura com IA deste mês acabou. Ela renova em ${renovaEm(agora)}.${ALTERNATIVA}` } satisfies Bloqueio;
    if (total.plus(valor).gt(cfg.globalUsdMes)) return { codigo: "GLOBAL_ESGOTADO", mensagem: "A leitura com IA está indisponível no momento." + ALTERNATIVA } satisfies Bloqueio;
    const [emCursoConta, emCursoGlobal] = await Promise.all([
      tx.usoIa.count({ where: { contaId: o.contaId, status: "RESERVADO" } }),
      tx.usoIa.count({ where: { status: "RESERVADO" } }),
    ]);
    if (emCursoConta >= cfg.concorrenciaConta || emCursoGlobal >= cfg.concorrenciaGlobal)
      return { codigo: "OCUPADO", mensagem: "Já há uma leitura com IA em andamento. Aguarde ela terminar e tente de novo." } satisfies Bloqueio;
    if (o.usuarioId && o.tentativa === 1) {
      const hoje = await tx.usoIa.count({ where: { usuarioId: o.usuarioId, tentativa: 1, status: { not: "CACHE" }, criadoEm: { gt: new Date(agora.getTime() - 86_400_000) } } });
      if (hoje >= cfg.usuarioPorDia) return { codigo: "USUARIO_DIA", mensagem: `Você chegou ao limite de ${cfg.usuarioPorDia} leituras com IA em 24 horas.${ALTERNATIVA}` } satisfies Bloqueio;
    }
    const r = await tx.usoIa.create({
      data: {
        contaId: o.contaId,
        usuarioId: o.usuarioId,
        operacao: o.operacao,
        modelo: o.modelo,
        periodo,
        status: "RESERVADO",
        custoReservadoUsd: valor.toFixed(6),
        bytes: o.bytes,
        paginas: o.paginas,
        hashDocumento: o.hashDocumento,
        tentativa: o.tentativa,
        criadoEm: agora,
      },
    });
    return { id: r.id, custoReservadoUsd: valor };
  });
}

export function eReserva(r: Reserva | Bloqueio): r is Reserva {
  return "id" in r;
}

export type Uso = { entrada: number; saida: number; cacheLeitura?: number; cacheEscrita?: number };

/** Consolida o custo real (libera a diferença para o saldo). Só muda reserva ainda aberta: chamar duas vezes não conta duas vezes. */
export async function concluir(id: string, modelo: string, u: Uso, duracaoMs: number) {
  await db.usoIa.updateMany({
    where: { id, status: "RESERVADO" },
    data: {
      status: "CONCLUIDO",
      custoRealUsd: custoUsd(modelo, u).toFixed(6),
      tokensEntrada: u.entrada,
      tokensSaida: u.saida,
      tokensCacheLeitura: u.cacheLeitura ?? 0,
      tokensCacheEscrita: u.cacheEscrita ?? 0,
      duracaoMs,
      concluidoEm: new Date(),
    },
  });
}

/** Falha. "NAO": a API respondeu erro (não cobra). "INCERTO": tempo esgotado ou conexão caída (conta o reservado). */
export async function falhar(id: string, cobrado: "NAO" | "INCERTO", erro: string, duracaoMs: number) {
  const r = await db.usoIa.findUnique({ where: { id } });
  if (!r || r.status !== "RESERVADO") return;
  await db.usoIa.updateMany({
    where: { id, status: "RESERVADO" },
    data: { status: cobrado === "NAO" ? "FALHOU" : "INCERTO", custoRealUsd: cobrado === "NAO" ? "0" : r.custoReservadoUsd, erro: erro.slice(0, 300), duracaoMs, concluidoEm: new Date() },
  });
}

/** Reserva esquecida (processo caiu no meio): vira EXPIRADO contando o valor reservado. Devolve quantas expiraram. */
export async function expirarReservasIa(agora = new Date()) {
  const limite = new Date(agora.getTime() - configIa().reservaExpiraMin * 60_000);
  const antigas = await db.usoIa.findMany({ where: { status: "RESERVADO", criadoEm: { lt: limite } }, select: { id: true, custoReservadoUsd: true } });
  for (const a of antigas)
    await db.usoIa.updateMany({ where: { id: a.id, status: "RESERVADO" }, data: { status: "EXPIRADO", custoRealUsd: a.custoReservadoUsd, erro: "reserva expirou sem resposta", concluidoEm: agora } });
  return antigas.length;
}

/** Leitura reaproveitada do cache: registrada no livro com custo zero. */
export async function registrarCache(o: { contaId: string; usuarioId: string | null; operacao: OperacaoIa; modelo: string; bytes: number; hashDocumento: string }) {
  await db.usoIa.create({ data: { ...o, periodo: periodoDe(new Date()), status: "CACHE", custoReservadoUsd: "0", custoRealUsd: "0" } });
}

function renovaEm(agora: Date) {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1)).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Para a tela: quanto da cota do mês a conta usou (em %, sem expor custo) e quando renova. */
export async function resumoUsoIa(contaId: string, plano: PlanoId, agora = new Date()) {
  const cfg = configIa();
  const teto = cfg.planoUsdMes[plano];
  const usado = await gasto(db, periodoDe(agora), contaId);
  return {
    disponivel: !cfg.desligada && plano !== "GRATIS" && teto > 0 && cfg.globalUsdMes > 0,
    percentual: teto > 0 ? Math.min(100, Math.round(usado.div(teto).times(100).toNumber())) : 100,
    renovaEm: renovaEm(agora),
  };
}
