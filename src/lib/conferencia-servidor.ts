import "server-only";
import { db } from "./db";
import { consumirCotas } from "./cota";
import { ipConfiavel } from "./limite";
import { sha256 } from "./cripto";
import { ACAO_LINK_REVOGADO, lerTokenConferencia, situacaoConferencia, type TokenConferencia } from "./conferencia";

/** Momento da última revogação dos links de conferência do pedido (registrada no histórico), ou null. */
export async function revogacaoDoPedido(pedidoId: string) {
  const h = await db.historico.findFirst({ where: { pedidoId, acao: ACAO_LINK_REVOGADO }, orderBy: { criadoEm: "desc" }, select: { criadoEm: true } });
  return h?.criadoEm ?? null;
}

function carregarPedido(pedidoId: string, contaId: string) {
  return db.pedido.findFirst({
    where: { id: pedidoId, contrato: { empresa: { contaId } } },
    include: { contrato: { include: { empresa: { include: { conta: true } }, convencao: true } }, convencao: true },
  });
}
type PedidoConferido = NonNullable<Awaited<ReturnType<typeof carregarPedido>>>;

/** Cotas por dia, como as outras rotas públicas: por link e, com proxy de confiança, por IP. */
const COTA_LINK = 300;
const COTA_IP = 600;

/**
 * Abre a conferência a partir do token da URL: confere a cota, a assinatura, o vencimento e a revogação, e
 * carrega o pedido só se ele ainda é da conta que emitiu o link. Nunca diz se o pedido existe.
 */
export async function abrirConferencia(token: string, cabecalhos: Headers): Promise<{ erro: "invalido" | "vencido" | "revogado" | "limite" } | { erro?: undefined; t: TokenConferencia; p: PedidoConferido }> {
  const t = lerTokenConferencia(token);
  if (!t) return { erro: "invalido" as const };
  const ip = ipConfiavel(cabecalhos);
  const cabe = await consumirCotas([{ chave: `conferir:link:${sha256(token).slice(0, 32)}`, limite: COTA_LINK }, ...(ip ? [{ chave: `conferir:ip:${ip}`, limite: COTA_IP }] : [])]);
  if (!cabe) return { erro: "limite" as const };
  const situacao = situacaoConferencia(t, await revogacaoDoPedido(t.pedidoId));
  if (situacao !== "ok") return { erro: situacao };
  const p = await carregarPedido(t.pedidoId, t.contaId);
  // o pedido da jornada segue a mesma regra do resto do sistema: escondido enquanto a chave está desligada
  if (!p || p.gatilho === "JORNADA_EC141") return { erro: "invalido" as const };
  return { t, p };
}

/** Registra no histórico do pedido o acesso pela conferência; a mesma abertura da página conta uma vez por hora. */
export async function registrarAcessoConferencia(p: { id: string; contratoId: string; contrato: { empresa: { contaId: string } } }, oque: string) {
  const acao = `Conferência pelo contador: ${oque}`;
  const recente = await db.historico.findFirst({ where: { pedidoId: p.id, acao, criadoEm: { gte: new Date(Date.now() - 3_600_000) } }, select: { id: true } });
  if (recente) return;
  await db.historico.create({ data: { contaId: p.contrato.empresa.contaId, pedidoId: p.id, contratoId: p.contratoId, acao } });
}
