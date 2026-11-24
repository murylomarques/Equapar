import { db } from "@/lib/db";
import type { Contexto } from "@/lib/auth";
import { agrupar, classificar, ordenar, type EnvioAviso } from "@/lib/central-avisos";
import { situacaoEfetiva } from "@/lib/planos";

/** Quantos avisos a página carrega (o contador do menu usa o mesmo limite, para nunca divergir). */
export const LIMITE_AVISOS = 300;

type Linha = EnvioAviso & { chave: string; tipo: string; contratoId: string | null };

/**
 * Agrupa e classifica os avisos da conta como a página Avisos mostra: destinos conferidos no banco, só dentro da conta.
 * Usado pela página e pelo contador do menu, para os dois contarem exatamente os mesmos itens.
 */
export async function classificarAvisos(ctx: Contexto, linhas: Linha[]) {
  const eventos = agrupar(linhas);
  const contratoIds = [...new Set(eventos.map((e) => e.contratoId).filter((x): x is string => !!x))];
  const pedidoIds = [...new Set(eventos.map((e) => e.pedidoId).filter((x): x is string => !!x))];
  const [contratos, pedidos] = await Promise.all([
    contratoIds.length
      ? db.contrato.findMany({ where: { id: { in: contratoIds }, empresa: { contaId: ctx.conta.id } }, select: { id: true, numero: true, orgao: true, vigenciaFim: true, arquivado: true } })
      : [],
    pedidoIds.length
      ? db.pedido.findMany({ where: { id: { in: pedidoIds }, contrato: { empresa: { contaId: ctx.conta.id } } }, select: { id: true, estado: true, apostiladoEm: true, contratoId: true } })
      : [],
  ]);
  const contratoDe = new Map(contratos.map((c) => [c.id, c]));
  const pedidoDe = new Map(pedidos.map((p) => [p.id, p]));
  const contaEmDia = situacaoEfetiva(ctx.conta.situacaoCobranca, ctx.conta.carenciaAte) === "EM_DIA";
  const itens = ordenar(
    eventos.map((ev) => ({
      ev,
      c: classificar(ev, { contrato: ev.contratoId ? (contratoDe.get(ev.contratoId) ?? null) : null, pedido: ev.pedidoId ? (pedidoDe.get(ev.pedidoId) ?? null) : null, contaEmDia }),
    })),
  );
  return { eventos, itens };
}

/** "Precisa de você": pendentes que pedem ação (não informativos), um por evento de negócio. */
export function ehPendente(x: { c: { situacao: string; categoria: string } }) {
  return x.c.situacao === "PENDENTE" && x.c.categoria !== "INFO";
}

/** Contador do menu: o mesmo número da aba "Precisa de você", lendo só as colunas necessárias. */
export async function contarAvisosPendentes(ctx: Contexto) {
  const linhas = await db.aviso.findMany({
    where: { contaId: ctx.conta.id },
    orderBy: { enviadoEm: "desc" },
    take: LIMITE_AVISOS,
    select: { id: true, chave: true, tipo: true, contratoId: true, enviadoEm: true, assunto: true },
  });
  const leves: Linha[] = linhas.map((l) => ({ ...l, canal: "", destino: "", status: "", erro: null, corpo: "" }));
  const { itens } = await classificarAvisos(ctx, leves);
  return itens.filter(ehPendente).length;
}
