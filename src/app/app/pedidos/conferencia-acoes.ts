"use server";
import { revalidatePath } from "next/cache";
import { exigir, pedidoDaConta, registrarHistorico } from "@/lib/auth";
import { db } from "@/lib/db";
import { tentar, texto, type Resultado } from "@/lib/acao";
import { appUrl } from "@/lib/mensagens";
import { data } from "@/lib/format";
import { calcularPedido } from "@/lib/pedido";
import { ACAO_LINK_CRIADO, ACAO_LINK_REVOGADO, tokenConferencia, VALIDADE_CONFERENCIA_MS } from "@/lib/conferencia";

/** Dono, Gerente de contratos e Contador (quem monta pedidos) criam o link de leitura para o contador externo. */
export async function criarLinkConferencia(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.gatilho === "JORNADA_EC141") return { erro: "A conferência por link ainda não vale para o pedido da jornada." };
    const calc = calcularPedido(p);
    if (!calc.comparacao || calc.comparacao.erros.length) return { erro: "A memória ainda não pode ser montada. Resolva as pendências do passo 3 antes de enviar para conferência." };
    const agora = Date.now();
    const link = appUrl(`/conferir/${tokenConferencia(p.id, ctx.conta.id, agora)}`);
    await registrarHistorico(ctx, ACAO_LINK_CRIADO, { pedidoId: p.id, contratoId: p.contratoId, detalhe: `Vale até ${data(new Date(agora + VALIDADE_CONFERENCIA_MS))}.` });
    revalidatePath(`/app/pedidos/${p.id}/memoria`);
    return { ok: "Link criado. Copie e envie ao contador.", dados: { link } };
  });
}

/** Desativa todos os links de conferência já criados para o pedido (os novos voltam a valer). */
export async function revogarLinksConferencia(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    // a data é a do servidor da aplicação, a mesma usada na emissão dos links
    await db.historico.create({ data: { contaId: ctx.conta.id, usuarioId: ctx.usuario.id, pedidoId: p.id, contratoId: p.contratoId, acao: ACAO_LINK_REVOGADO, criadoEm: new Date() } });
    revalidatePath(`/app/pedidos/${p.id}/memoria`);
    return { ok: "Links desativados. Quem tinha o link não consegue mais abrir." };
  });
}
