"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { contratoDaConta, exigir, pedidoDaConta, registrarHistorico } from "@/lib/auth";
import { db } from "@/lib/db";
import { tentar, texto, type Resultado } from "@/lib/acao";
import { registrarEvento } from "@/lib/eventos";
import { hora, hojeUTC, lerData, lerDinheiro } from "@/lib/format";
import { avisarDeferido, avisarProtocolo } from "@/lib/avisos";
import { calcularPedido, situacaoChecklist } from "@/lib/pedido";
import { validarPlanilha } from "@/lib/calculo/motor";
import { clonarPlanilha, planilhaModelo } from "@/lib/calculo/modelo";
import type { PlanilhaCustos } from "@/lib/calculo/tipos";
import { iaAtiva, lerPlanilhaPdf } from "@/lib/ia";
import { deLeituraIa, importarExcel } from "@/lib/planilha-import";
import { salvarArquivo } from "@/lib/storage";
import { oportunidade } from "@/lib/prazos";

const json = (v: unknown) => v as Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

async function criarPedido(ctx: Awaited<ReturnType<typeof exigir>>, contratoId: string) {
  const c = await contratoDaConta(ctx, contratoId);
  const aberto = await db.pedido.findFirst({ where: { contratoId: c.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } });
  if (aberto) return aberto;
  const completo = await db.contrato.findUnique({ where: { id: c.id }, include: { convencao: true, pedidos: true } });
  const op = completo ? oportunidade(completo) : null;
  // reaproveita a planilha "agora" do último pedido deferido como planilha atual
  const anterior = await db.pedido.findFirst({
    where: { contratoId: c.id, estado: { in: ["DEFERIDO", "FATURADO", "RECEBIDO"] }, planilhaAgora: { not: undefined } },
    orderBy: { criadoEm: "desc" },
  });
  const p = await db.pedido.create({
    data: {
      contratoId: c.id,
      convencaoId: c.convencaoId,
      dataBase: op?.dataBase ?? null,
      dataDeposito: c.convencao?.dataDeposito ?? null,
      planilhaAntes: anterior?.planilhaAgora ? json(anterior.planilhaAgora) : undefined,
    },
  });
  await registrarHistorico(ctx, "Iniciou o pedido de repactuação", { contratoId: c.id, pedidoId: p.id });
  await registrarEvento("pedido_iniciado", { emLote: false });
  return p;
}

export async function iniciarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  let id = "";
  const r = await tentar(async () => {
    const ctx = await exigir("editar_pedidos");
    id = (await criarPedido(ctx, texto(fd, "contratoId"))).id;
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${id}`);
}

/** "Montar pedidos para os {n} contratos desta convenção" */
export async function iniciarPedidosEmLote(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const ctx = await exigir("editar_pedidos");
    const ids = fd.getAll("contratoId").map(String);
    if (!ids.length) return { erro: "Nenhum contrato selecionado." };
    for (const id of ids) await criarPedido(ctx, id);
  });
  if (r.erro) return r;
  redirect("/app/pedidos?estado=EM_ANALISE");
}

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------

async function pedidoEditavel(fd: FormData) {
  const ctx = await exigir("editar_pedidos");
  const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
  if (!["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado)) throw new Error("Este pedido já foi protocolado e não pode mais ser alterado.");
  return { ctx, p };
}

export async function salvarPasso1(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { ctx, p } = await pedidoEditavel(fd);
    const gatilho = z.enum(["NOVA_CONVENCAO", "ACORDO_DISSIDIO", "OUTRO_CUSTO"]).parse(texto(fd, "gatilho") || "NOVA_CONVENCAO");
    const convencaoId = texto(fd, "convencaoId") || null;
    const dataBase = lerData(fd.get("dataBase"));
    const dataDeposito = lerData(fd.get("dataDeposito"));
    const descricao = texto(fd, "descricaoGatilho") || null;
    if (convencaoId && !(await db.convencao.findFirst({ where: { id: convencaoId, contaId: ctx.conta.id } }))) return { erro: "Convenção inválida." };
    if (gatilho !== "OUTRO_CUSTO" && !convencaoId) return { erro: "Escolha a convenção (ou cadastre a nova em Convenções)." };
    if (!dataBase) return { erro: "Falta a data-base. Ela marca o início da diferença a receber." };
    if (gatilho !== "OUTRO_CUSTO" && !dataDeposito) return { erro: "Falta a data do depósito da convenção. Sem ela, o órgão pode devolver o pedido." };
    if (gatilho === "OUTRO_CUSTO" && !descricao) return { erro: "Descreva qual custo mudou." };
    await db.pedido.update({ where: { id: p.id }, data: { gatilho, convencaoId, dataBase, dataDeposito, descricaoGatilho: descricao, passoAtual: Math.max(p.passoAtual, 2) } });
    if (convencaoId && dataDeposito) await db.convencao.update({ where: { id: convencaoId }, data: { dataDeposito, situacao: "REGISTRADA" } });
    await registrarEvento("passo_concluido", { passo: 1 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/2`);
}

const linhaSchema = z.object({
  id: z.string().min(1),
  modulo: z.enum(["M1", "M2_1", "M2_2", "M2_3", "M3", "M4", "M5", "M6_CI", "M6_LUCRO", "M6_TRIBUTOS"]),
  descricao: z.string().max(200),
  tipo: z.enum(["VALOR", "PERCENTUAL"]),
  valor: z.string().max(40),
  base: z.enum(["SALARIO_BASE", "M1", "M1_M21", "M1_M3", "SUBTOTAL", "SUBTOTAL_CI", "POR_DENTRO"]).optional(),
  salarioBase: z.boolean().optional(),
  fonte: z.string().max(300).optional(),
});
const planilhaSchema = z.object({
  tipos: z.array(z.object({ id: z.string().min(1), nome: z.string().max(100), quantidade: z.number().int().min(0).max(100000), linhas: z.array(linhaSchema).max(200) })).max(30),
});

/** Salvamento automático do editor (passos 2 e 3). */
export async function salvarPlanilha(pedidoId: string, qual: "antes" | "agora", conteudo: string): Promise<Resultado> {
  return tentar(async () => {
    const fd = new FormData();
    fd.set("pedidoId", pedidoId);
    const { ctx, p } = await pedidoEditavel(fd);
    const planilha = planilhaSchema.parse(JSON.parse(conteudo)) as PlanilhaCustos;
    const data: Prisma.PedidoUpdateInput = qual === "antes" ? { planilhaAntes: json(planilha) } : { planilhaAgora: json(planilha) };
    // qualquer mudança na conta desfaz a aprovação da memória
    if (p.memoriaAprovadaEm) {
      Object.assign(data, { memoriaAprovadaEm: null, memoriaAprovadaPor: null, estado: "EM_ANALISE" });
      await registrarHistorico(ctx, "Alterou a planilha: a aprovação da memória foi desfeita", { pedidoId: p.id, contratoId: p.contratoId });
    }
    await db.pedido.update({ where: { id: p.id }, data });
    return { ok: `Salvo às ${hora(new Date())}` };
  });
}

export async function enviarPlanilha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const { ctx, p } = await pedidoEditavel(fd);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo da planilha." };
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    await db.documento.create({ data: { pedidoId: p.id, contratoId: p.contratoId, tipo: "PLANILHA", nome: s.nome, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
    let imp;
    if (s.mime.includes("spreadsheet") || s.nome.toLowerCase().endsWith(".xlsx")) imp = await importarExcel(s.buffer);
    else if (s.mime === "application/pdf") {
      if (!iaAtiva())
        return {
          erro: "O PDF foi anexado, mas a leitura automática de PDF está desligada neste ambiente. Envie a planilha em Excel ou preencha as linhas abaixo a partir do modelo.",
        };
      imp = deLeituraIa(await lerPlanilhaPdf(s.buffer));
    } else return { erro: "Envie a planilha em Excel (.xlsx) ou PDF." };
    if (!imp.planilha.tipos.length) return { erro: "Não achamos linhas de custo neste arquivo. Confira se é a planilha de custos ou preencha a partir do modelo." };
    await db.pedido.update({
      where: { id: p.id },
      data: { planilhaAntes: json(imp.planilha), planilhaAgora: undefined, linhasNaoLidas: json(imp.naoLidas), memoriaAprovadaEm: null, memoriaAprovadaPor: null },
    });
    await registrarHistorico(ctx, `Enviou a planilha atual (${s.nome})`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/2`);
    return { ok: `Lemos ${imp.lidas} linhas.${imp.naoLidas.length ? ` Confira as ${imp.naoLidas.length} que não entendemos.` : ""}` };
  });
}

export async function usarModelo(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const { p } = await pedidoEditavel(fd);
    await db.pedido.update({ where: { id: p.id }, data: { planilhaAntes: json(planilhaModelo()), linhasNaoLidas: json([]) } });
    revalidatePath(`/app/pedidos/${p.id}/passo/2`);
    return { ok: "Modelo em branco criado. Preencha com os números da proposta." };
  });
}

export async function concluirPasso2(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { p } = await pedidoEditavel(fd);
    if (!p.planilhaAntes) return { erro: "Envie a planilha atual ou comece do modelo." };
    const erros = validarPlanilha(p.planilhaAntes as unknown as PlanilhaCustos);
    if (erros.length) return { erro: `Ainda há pendências na planilha: ${erros[0]}` };
    await db.pedido.update({
      where: { id: p.id },
      data: {
        passoAtual: Math.max(p.passoAtual, 3),
        linhasNaoLidas: json([]),
        planilhaAgora: p.planilhaAgora ? undefined : json(clonarPlanilha(p.planilhaAntes as unknown as PlanilhaCustos)),
      },
    });
    await registrarEvento("passo_concluido", { passo: 2 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/3`);
}

export async function concluirPasso3(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { p } = await pedidoEditavel(fd);
    const ref = lerData(fd.get("dataReferencia")) ?? hojeUTC();
    const calc = calcularPedido({ ...p, dataReferencia: ref });
    if (!calc.comparacao) return { erro: "Falta a planilha nova." };
    if (calc.comparacao.erros.length) return { erro: calc.comparacao.erros[0] };
    if (Number(calc.comparacao.diferencaMensal) <= 0) return { erro: "A planilha nova não aumenta o valor mensal. Confira os novos custos antes de continuar." };
    await db.pedido.update({
      where: { id: p.id },
      data: {
        dataReferencia: ref,
        diferencaMensal: calc.comparacao.diferencaMensal,
        diferencaRetroativa: calc.retroativo?.total ?? null,
        passoAtual: Math.max(p.passoAtual, 4),
      },
    });
    await registrarEvento("passo_concluido", { passo: 3 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/4`);
}

export async function anexarDocumentoPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const { ctx, p } = await pedidoEditavel(fd);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo." };
    const tipo = texto(fd, "tipo") || "OUTRO";
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    await db.documento.create({ data: { pedidoId: p.id, contratoId: p.contratoId, tipo, nome: s.nome, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
    const item = texto(fd, "item");
    if (item) {
      const marcado = { ...((p.checklist as Record<string, string> | null) ?? {}), [item]: "ANEXADO" };
      await db.pedido.update({ where: { id: p.id }, data: { checklist: json(marcado) } });
    }
    await registrarHistorico(ctx, `Anexou ${s.nome}`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/4`);
    return { ok: "Anexado." };
  });
}

export async function marcarItem(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const { p } = await pedidoEditavel(fd);
    const item = texto(fd, "item");
    const valor = texto(fd, "valor") === "ANEXADO" ? "ANEXADO" : "FALTA";
    const marcado = { ...((p.checklist as Record<string, string> | null) ?? {}), [item]: valor };
    await db.pedido.update({ where: { id: p.id }, data: { checklist: json(marcado) } });
    revalidatePath(`/app/pedidos/${p.id}/passo/4`);
  });
}

export async function concluirPasso4(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { p } = await pedidoEditavel(fd);
    const docs = await db.documento.findMany({ where: { pedidoId: p.id } });
    const faltam = situacaoChecklist(p, docs).filter((i) => i.situacao === "FALTA");
    if (faltam.length) return { erro: `Falta: ${faltam.map((f) => f.nome.toLowerCase()).join("; ")}. Sem isso, o órgão pode devolver o pedido.` };
    await db.pedido.update({ where: { id: p.id }, data: { passoAtual: Math.max(p.passoAtual, 5) } });
    await registrarEvento("passo_concluido", { passo: 4 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/5`);
}

export async function gerarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { ctx, p } = await pedidoEditavel(fd);
    if (!p.memoriaAprovadaEm) return { erro: "A memória de cálculo precisa ser aprovada por Contador ou Dono antes de gerar o pedido." };
    const calc = calcularPedido(p);
    if (!calc.pronto) return { erro: "O cálculo tem pendências. Volte ao passo 3." };
    await db.pedido.update({
      where: { id: p.id },
      data: { estado: "CALCULO_VALIDADO", geradoEm: new Date(), revisaoEspecialista: fd.get("revisao") === "on", passoAtual: 5 },
    });
    await registrarHistorico(ctx, fd.get("revisao") === "on" ? "Gerou o pedido e pediu revisão de especialista" : "Gerou o pedido", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("pedido_gerado", { revisao: fd.get("revisao") === "on" });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/pronto`);
}

// ---------------------------------------------------------------------------
// Memória
// ---------------------------------------------------------------------------

export async function aprovarMemoria(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("aprovar_memoria");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (!["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado)) return { erro: "Este pedido já foi protocolado." };
    const calc = calcularPedido(p);
    if (!calc.pronto) return { erro: "O cálculo ainda tem pendências e não pode ser aprovado." };
    await db.pedido.update({ where: { id: p.id }, data: { memoriaAprovadaEm: new Date(), memoriaAprovadaPor: ctx.usuario.nome } });
    await registrarHistorico(ctx, "Aprovou a memória de cálculo", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("memoria_aprovada");
    revalidatePath(`/app/pedidos/${p.id}`, "layout");
    return { ok: "Memória aprovada." };
  });
}

export async function comentarLinha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("ver");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    const t = texto(fd, "texto");
    if (!t) return { erro: "Escreva o comentário." };
    if (ctx.papel === "LEITURA") return { erro: "Seu papel é só de leitura." };
    await db.comentarioLinha.create({ data: { pedidoId: p.id, linhaId: texto(fd, "linhaId"), usuarioId: ctx.usuario.id, texto: t.slice(0, 1000) } });
    revalidatePath(`/app/pedidos/${p.id}/memoria`);
    return { ok: "Comentário salvo." };
  });
}

// ---------------------------------------------------------------------------
// Acompanhamento até o dinheiro entrar
// ---------------------------------------------------------------------------

export async function registrarProtocolo(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "CALCULO_VALIDADO") return { erro: "Gere o pedido antes de registrar o protocolo." };
    const numero = texto(fd, "protocoloNumero");
    const dataP = lerData(fd.get("protocoloData"));
    if (!numero) return { erro: "Informe o número do protocolo." };
    if (!dataP) return { erro: "Informe a data do protocolo." };
    await db.pedido.update({ where: { id: p.id }, data: { estado: "PROTOCOLADO", protocoloNumero: numero, protocoloData: dataP } });
    await registrarHistorico(ctx, `Registrou o protocolo ${numero}`, { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("protocolo_registrado");
    await avisarProtocolo(p.id);
    revalidatePath("/app", "layout");
    return { ok: "Protocolo registrado. O pedido foi para “Aguardando o órgão”." };
  });
}

export async function registrarResposta(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "PROTOCOLADO") return { erro: "Só pedidos protocolados recebem resposta." };
    const resultado = texto(fd, "resultado");
    const dataR = lerData(fd.get("respostaData"));
    if (!dataR) return { erro: "Informe a data da resposta." };
    const resumo = texto(fd, "respostaResumo") || null;
    if (resultado === "INDEFERIDO") {
      await db.pedido.update({ where: { id: p.id }, data: { estado: "INDEFERIDO", respostaData: dataR, respostaResumo: resumo } });
      await registrarHistorico(ctx, "Registrou o indeferimento", { pedidoId: p.id, contratoId: p.contratoId, detalhe: resumo ?? undefined });
    } else {
      const valor = lerDinheiro(fd.get("valorDeferido"));
      if (!valor) return { erro: "Informe o valor deferido (a diferença retroativa reconhecida pelo órgão)." };
      await db.pedido.update({ where: { id: p.id }, data: { estado: "DEFERIDO", respostaData: dataR, deferidoEm: dataR, valorDeferido: valor, respostaResumo: resumo } });
      await registrarHistorico(ctx, "Registrou o deferimento", { pedidoId: p.id, contratoId: p.contratoId });
      await avisarDeferido(p.id);
    }
    await registrarEvento("resposta_registrada", { resultado: resultado === "INDEFERIDO" ? "indeferido" : "deferido" });
    revalidatePath("/app", "layout");
    return { ok: "Resposta registrada." };
  });
}

export async function registrarApostilamento(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "DEFERIDO") return { erro: "O apostilamento vem depois do deferimento." };
    const d = lerData(fd.get("apostiladoEm"));
    if (!d) return { erro: "Informe a data do apostilamento." };
    await db.pedido.update({ where: { id: p.id }, data: { apostiladoEm: d } });
    const calc = calcularPedido(p);
    await db.contrato.update({
      where: { id: p.contratoId },
      data: { ultimoApostilamento: d, ...(calc.comparacao && !calc.comparacao.erros.length ? { valorMensal: calc.comparacao.mensalAgora } : {}) },
    });
    await registrarHistorico(ctx, "Registrou o apostilamento", { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath("/app", "layout");
    return { ok: "Apostilamento registrado." };
  });
}

/** "Gerar cobrança da diferença": registra a nota fiscal separada das diferenças retroativas. */
export async function gerarCobranca(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "DEFERIDO") return { erro: "Só valores deferidos podem ser faturados." };
    if (!p.apostiladoEm) return { erro: "Registre o apostilamento antes de faturar. Sem ele, o órgão não paga a diferença." };
    const nf = texto(fd, "notaFiscal");
    const d = lerData(fd.get("faturadoEm"));
    if (!nf || !d) return { erro: "Informe o número da nota fiscal da diferença e a data." };
    await db.pedido.update({ where: { id: p.id }, data: { estado: "FATURADO", notaFiscal: nf, faturadoEm: d } });
    await registrarHistorico(ctx, `Faturou a diferença (NF ${nf})`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath("/app", "layout");
    return { ok: "Cobrança registrada." };
  });
}

export async function marcarRecebido(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "FATURADO") return { erro: "Registre a fatura da diferença antes de marcar como recebido." };
    const d = lerData(fd.get("recebidoEm"));
    const valor = lerDinheiro(fd.get("valorRecebido"));
    if (!d || !valor) return { erro: "Informe a data e o valor recebido." };
    await db.pedido.update({ where: { id: p.id }, data: { estado: "RECEBIDO", recebidoEm: d, valorRecebido: valor } });
    await registrarHistorico(ctx, "Marcou a diferença como recebida", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("diferenca_recebida");
    revalidatePath("/app", "layout");
    return { ok: "Recebido. O pedido saiu da lista." };
  });
}

export async function descartarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const { ctx, p } = await pedidoEditavel(fd);
    await db.pedido.delete({ where: { id: p.id } });
    await registrarHistorico(ctx, "Descartou um pedido em análise", { contratoId: p.contratoId });
  });
  if (r.erro) return r;
  redirect("/app/pedidos");
}
