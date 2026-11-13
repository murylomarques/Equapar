import "server-only";
/**
 * D0. Chave mestra da jornada (JORNADA_REGRA_CONFIRMADA, padrão false). Desligada: cliente nenhum vê a
 * jornada (telas, ações, documentos, avisos e site); só os e-mails de PAINEL_EMAILS veem, com a marca de
 * simulação em toda tela, PDF e Word. Ligada: liberada para todos, sem a marca.
 * A checagem é no SERVIDOR (rotas e ações), não só na tela.
 */
import { notFound } from "next/navigation";
import { jornadaLiberada } from "./chaves";
import { podeVerPainel } from "./metricas";
import { ErroUsuario } from "./acao";

export const MARCA_SIMULACAO_JORNADA = "SIMULAÇÃO: regra em validação. Não protocolar.";

export function jornadaVisivelPara(email: string) {
  return jornadaLiberada() || podeVerPainel(email);
}

/** A marca aparece enquanto a chave estiver desligada (só quem está em PAINEL_EMAILS chega a ver). */
export function jornadaEmSimulacao() {
  return !jornadaLiberada();
}

/** Páginas: pedido da jornada para quem não pode ver = 404. */
export function paginaJornada(email: string, p: { gatilho: string }) {
  if (p.gatilho === "JORNADA_EC141" && !jornadaVisivelPara(email)) notFound();
}

/** Ações: recusa como se o pedido não existisse. */
export function acaoJornada(email: string, gatilho: string | null | undefined) {
  if (gatilho === "JORNADA_EC141" && !jornadaVisivelPara(email)) throw new ErroUsuario("Pedido não encontrado.");
}
