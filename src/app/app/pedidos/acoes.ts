"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type NotaFiscalPedido } from "@prisma/client";
import Decimal from "decimal.js";
import { contratoDaConta, exigir, pedidoDaConta, registrarHistorico } from "@/lib/auth";
import { db } from "@/lib/db";
import { ErroCampos, tentar, texto, type Resultado, ErroUsuario } from "@/lib/acao";
import { registrarEvento } from "@/lib/eventos";
import { data, hora, hojeUTC, lerData, lerDinheiro, dataLocal } from "@/lib/format";
import { avisarDeferido, avisarProtocolo } from "@/lib/avisos";
import { calcularPedido } from "@/lib/pedido";
import { validarPlanilha } from "@/lib/calculo/motor";
import { clonarPlanilha, planilhaModelo } from "@/lib/calculo/modelo";
import type { PlanilhaCustos } from "@/lib/calculo/tipos";
import { lerConvencaoPdf, lerPlanilhaPdf } from "@/lib/ia";
import { deLeituraIa, importarExcel, type LinhaNaoLida } from "@/lib/planilha-import";
import { apagarArquivo, gravarArquivo, lerArquivo, salvarArquivo } from "@/lib/storage";
import crypto from "node:crypto";
import path from "node:path";
import { oportunidade } from "@/lib/prazos";
import { aoTrocarPlanilhaAtual, dadosInvalidarAprovacao, hashCalculo, pendenciasParaGerar, snapshotCalculo, totaisGravados, type DadosAprovacaoDesfeita, type Pendencia } from "@/lib/pedido-regras";
import { memoriaPdf, oficioPdf, planilhaXlsx } from "@/lib/documentos";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { limiteDoPlano } from "@/lib/planos";
import { etapaNaData, etapasJornada, JORNADA, planilhaDoCenario, type Cenario } from "@/lib/jornada";
import { proximaVersao } from "@/lib/versao-documento";
import { aplicarConfirmadas, filtrarSugestoes, fonteDaSugestao, linhasParaConvencao, normalizarNumero, type SugestoesConvencao } from "@/lib/sugestoes-convencao";
import { acaoJornada } from "@/lib/jornada-acesso";
import { iaPara } from "@/lib/ia-acesso";
import { contarCpfs, MENSAGEM_CPF } from "@/lib/cpf";
import { textoDoPdf } from "@/lib/pdf-texto";
import type { CompetenciaRetroativo } from "@/lib/retroativo-competencias";
import { resumoFinanceiro, validarLancamento } from "@/lib/financeiro-pedido";

const json = (v: unknown) => v as Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

async function criarPedido(ctx: Awaited<ReturnType<typeof exigir>>, contratoId: string, motivo: "CONVENCAO" | "JORNADA" = "CONVENCAO") {
  const c = await contratoDaConta(ctx, contratoId);
  const jornada = motivo === "JORNADA";
  // 5.1: o pedido da jornada corre ao lado do pedido da convenção; cada um tem o seu
  const aberto = await db.pedido.findFirst({
    where: { contratoId: c.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] }, gatilho: jornada ? "JORNADA_EC141" : { not: "JORNADA_EC141" } },
  });
  if (aberto) return aberto;
  const completo = await db.contrato.findUnique({ where: { id: c.id }, include: { convencao: true, pedidos: true } });
  const op = completo ? oportunidade(completo) : null;
  // reaproveita a planilha "agora" do último pedido deferido como planilha atual
  const anterior = await db.pedido.findFirst({
    where: { contratoId: c.id, estado: { in: ["DEFERIDO", "FATURADO", "RECEBIDO"] }, planilhaAgora: { not: Prisma.AnyNull } },
    orderBy: { criadoEm: "desc" },
  });
  // depois do início das 40 horas, o pedido novo é da segunda etapa (42 para 40)
  const de40 = jornada && hojeUTC() >= JORNADA.inicio40();
  const inicio = jornada ? (de40 ? JORNADA.inicio40() : JORNADA.inicio42()) : null;
  const p = await db.pedido.create({
    data: jornada
      ? {
          contratoId: c.id,
          gatilho: "JORNADA_EC141",
          dataBase: inicio,
          inicioJornada: inicio,
          jornadaInicioEfeitos: inicio, // D4: padrão = início da etapa
          jornadaAntes: de40 ? 42 : 44,
          jornadaDepois: de40 ? 40 : 42,
          horasCobertura: "44.00",
          planilhaAntes: anterior?.planilhaAgora ? json(anterior.planilhaAgora) : undefined,
        }
      : {
          contratoId: c.id,
          convencaoId: c.convencaoId,
          dataBase: op?.dataBase ?? null,
          dataDeposito: c.convencao?.dataDeposito ?? null,
          planilhaAntes: anterior?.planilhaAgora ? json(anterior.planilhaAgora) : undefined,
        },
  });
  await registrarHistorico(ctx, jornada ? "Iniciou o pedido de reequilíbrio da jornada (EC 141/2026)" : "Iniciou o pedido de repactuação", { contratoId: c.id, pedidoId: p.id });
  await registrarEvento("pedido_iniciado", { emLote: false });
  return p;
}

export async function iniciarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  let id = "";
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    id = (await criarPedido(ctx, texto(fd, "contratoId"))).id;
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${id}`);
}

/** "Montar pedidos para os {n} contratos desta convenção" */
export async function iniciarPedidosEmLote(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const ids = fd.getAll("contratoId").map(String);
    if (!ids.length) return { erro: "Nenhum contrato selecionado." };
    const motivo = texto(fd, "motivo") === "JORNADA" ? "JORNADA" : "CONVENCAO";
    if (motivo === "JORNADA") acaoJornada(ctx.usuario.email, "JORNADA_EC141"); // D0
    for (const id of ids) await criarPedido(ctx, id, motivo);
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
  if (!["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado)) throw new ErroUsuario("Este pedido já foi protocolado e não pode mais ser alterado.");
  return { ctx, p };
}

type Ctx = Awaited<ReturnType<typeof exigir>>;
type PedidoAprov = { id: string; contratoId: string; memoriaAprovadaEm: Date | null; estado: string };

/**
 * C2. Ponto único para desfazer a aprovação da memória quando muda um número ou o fundamento do
 * cálculo (planilhas, data-base, data de referência, gatilho, convenção). Devolve os campos a gravar
 * junto com a mudança e registra o motivo no histórico. Sem aprovação nem pedido gerado, não faz nada.
 */
async function invalidarAprovacao(ctx: Ctx, p: PedidoAprov, motivo: string): Promise<DadosAprovacaoDesfeita> {
  const data = dadosInvalidarAprovacao(p);
  if (Object.keys(data).length) await registrarHistorico(ctx, `${motivo}: a aprovação da memória foi desfeita`, { pedidoId: p.id, contratoId: p.contratoId });
  return data;
}

/** C4: quando a montagem dos arquivos falha por um motivo conhecido, diz qual é (sem detalhe técnico). */
function motivoFalhaDocumento(e: unknown): string {
  const m = (e as Error)?.message ?? "";
  const car = m.match(/WinAnsi cannot encode "(.+?)"/);
  if (car) return `Um texto do pedido tem um caractere que o PDF não aceita ("${car[1]}"). Troque esse caractere (nas descrições ou fontes do passo 3) e tente de novo.`;
  if (/Worksheet name/i.test(m)) return "Dois tipos de posto ficaram com o mesmo nome na planilha do Excel. Renomeie um deles no passo 3 e tente de novo.";
  return "Não foi possível montar os arquivos do pedido. Tente de novo; se continuar, fale com o suporte.";
}

/** Resposta padrão quando há pendências: mensagem + link para o passo de cada uma. */
function recusarPorPendencias(pedidoId: string, pend: Pendencia[], titulo: string): Resultado {
  return {
    erro: titulo,
    pendencias: pend.map((x) => ({
      mensagem: x.mensagem,
      href: x.passo === 5 ? `/app/pedidos/${pedidoId}/memoria` : `/app/pedidos/${pedidoId}/passo/${x.passo}`,
      rotulo: x.passo === 5 ? "Revisar a memória" : `Ir ao passo ${x.passo}`,
    })),
  };
}

export async function salvarPasso1(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const gatilho = z.enum(["NOVA_CONVENCAO", "ACORDO_DISSIDIO", "OUTRO_CUSTO", "JORNADA_EC141"]).parse(texto(fd, "gatilho") || "NOVA_CONVENCAO");
    acaoJornada(ctx.usuario.email, gatilho); // D0: cliente não escolhe a jornada com a chave desligada
    const jornada = gatilho === "JORNADA_EC141";
    const convencaoId = jornada ? null : texto(fd, "convencaoId") || null;
    // D3/D4: a etapa vale pela data (44 → 42 a partir de JORNADA_42H_INICIO; 42 → 40 a partir de JORNADA_40H_INICIO).
    // Três datas: início da etapa (a data geral), data do aditivo (quando formalizado) e início dos efeitos
    // financeiros (padrão: o início da etapa; o retroativo usa esta). 44 → 40 num só aditivo fica fora.
    const etapa = jornada ? etapasJornada().find((e) => e.id === texto(fd, "etapa")) ?? null : null;
    const inicioJornada = etapa?.inicio ?? null;
    const jornadaInicioEfeitos = jornada ? lerData(fd.get("jornadaInicioEfeitos")) ?? inicioJornada : null;
    const jornadaDataAditivo = jornada ? lerData(fd.get("jornadaDataAditivo")) : null;
    const jornadaAntes = etapa?.antes ?? null;
    const jornadaDepois = etapa?.depois ?? null;
    const horasCobertura = jornada ? Number(texto(fd, "horasCobertura").replace(",", ".") || 0) : null;
    const dataBase = jornada ? inicioJornada : lerData(fd.get("dataBase"));
    const dataDeposito = lerData(fd.get("dataDeposito"));
    const descricao = texto(fd, "descricaoGatilho") || null;
    const conv = convencaoId ? await db.convencao.findFirst({ where: { id: convencaoId, contaId: ctx.conta.id } }) : null;
    if (convencaoId && !conv) return { erro: "Convenção inválida." };
    const campos: Record<string, string> = {};
    if (jornada) {
      if (!etapa) campos.etapa = "Escolha a etapa: de 44 para 42 horas ou de 42 para 40 horas.";
      // D3: os efeitos financeiros precisam cair dentro da etapa escolhida
      else if (jornadaInicioEfeitos && etapaNaData(jornadaInicioEfeitos)?.id !== etapa.id)
        campos.jornadaInicioEfeitos = `Os efeitos desta etapa começam em ${data(etapa.inicio)}${etapa.fim ? ` e vão até a véspera de ${data(etapa.fim)}` : ""}.`;
      if (!(horasCobertura! > 0)) campos.horasCobertura = "Digite as horas semanais de cobertura que o contrato exige por posto (ex.: 44).";
    }
    if (gatilho !== "OUTRO_CUSTO" && !jornada && !convencaoId) campos.convencaoId = "Escolha a convenção. Se ela não estiver na lista, cadastre em Convenções.";
    if (!dataBase && !jornada) campos.dataBase = "Falta a data-base. Ela marca o início da diferença a receber.";
    if (gatilho !== "OUTRO_CUSTO" && !jornada && !dataDeposito) campos.dataDeposito = "Falta a data do depósito da convenção. Sem ela, o órgão pode devolver o pedido.";
    if (gatilho === "OUTRO_CUSTO" && !descricao) campos.descricaoGatilho = "Descreva qual custo mudou.";
    if (Object.keys(campos).length) throw new ErroCampos(campos);
    const mudou: string[] = [];
    if (p.gatilho !== gatilho) mudou.push("o motivo");
    if ((p.convencaoId ?? null) !== convencaoId) mudou.push("a convenção");
    if (p.dataBase?.getTime() !== dataBase?.getTime()) mudou.push("a data-base");
    if (p.jornadaAntes !== jornadaAntes || p.jornadaDepois !== jornadaDepois || Number(p.horasCobertura ?? 0) !== Number(horasCobertura ?? 0) || p.jornadaInicioEfeitos?.getTime() !== jornadaInicioEfeitos?.getTime())
      mudou.push("os dados da jornada");
    const invalidar = mudou.length ? await invalidarAprovacao(ctx, p, `Alterou ${mudou.join(", ")}`) : {};
    await db.pedido.update({
      where: { id: p.id },
      data: {
        ...invalidar,
        ...totaisGravados({ ...p, dataBase }),
        gatilho,
        convencaoId,
        dataBase,
        dataDeposito: jornada ? null : dataDeposito,
        descricaoGatilho: descricao,
        jornadaAntes,
        jornadaDepois,
        horasCobertura: horasCobertura == null ? null : horasCobertura.toFixed(2),
        inicioJornada,
        jornadaInicioEfeitos,
        jornadaDataAditivo,
        ...(jornada ? {} : { cenarioJornada: null }),
        passoAtual: Math.max(p.passoAtual, 2),
      },
    });
    // L5: a convenção é compartilhada pelos contratos. Vazia, preenche; diferente, só com a confirmação da pessoa.
    if (conv && dataDeposito && conv.dataDeposito?.getTime() !== dataDeposito.getTime()) {
      if (!conv.dataDeposito) await db.convencao.update({ where: { id: conv.id }, data: { dataDeposito, situacao: "REGISTRADA" } });
      else if (fd.get("atualizarConvencao") === "on") {
        const n = await db.contrato.count({ where: { convencaoId: conv.id } });
        await db.convencao.update({ where: { id: conv.id }, data: { dataDeposito, situacao: "REGISTRADA" } });
        await registrarHistorico(ctx, `Atualizou a data de depósito da convenção ${conv.nome ?? ""} (usada por ${n} contratos)`.replace("  ", " "), { pedidoId: p.id, contratoId: p.contratoId });
      }
    }
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
  acompanhaEmpregados: z.boolean().optional(),
  origem: z
    .object({
      aba: z.string().max(120),
      linha: z.number().int().positive(),
      celula: z.string().max(30),
      conteudo: z.string().max(500),
      tipo: z.enum(["NUMERO", "TEXTO", "MOEDA", "PERCENTUAL", "FORMULA_COM_RESULTADO", "MANUAL"]),
      interpretacao: z.string().max(200),
    })
    .optional(),
  evidencia: z
    .object({
      instrumento: z.string().max(200),
      categoria: z.string().max(160),
      dataBase: z.string().max(10),
      clausula: z.string().max(160),
      parcela: z.string().max(160),
      justificativaOutraFonte: z.string().max(500).optional(),
      documentoId: z.string().max(80).optional(),
      anualidade: z.enum(["VALIDA", "REVISAO_NECESSARIA"]).optional(),
      motivoRevisao: z.string().max(500).optional(),
    })
    .optional(),
});
const planilhaSchema = z.object({
  tipos: z.array(z.object({ id: z.string().min(1), nome: z.string().max(100), quantidade: z.number().int().min(0).max(100000), linhas: z.array(linhaSchema).max(200) })).max(30),
});

/** Salvamento automático do editor (passos 2 e 3). */
export async function salvarPlanilha(pedidoId: string, qual: "antes" | "agora", conteudo: string): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const fd = new FormData();
    fd.set("pedidoId", pedidoId);
    const { ctx, p } = await pedidoEditavel(fd);
    const planilha = planilhaSchema.parse(JSON.parse(conteudo)) as PlanilhaCustos;
    const data: Prisma.PedidoUpdateInput = qual === "antes" ? { planilhaAntes: json(planilha) } : { planilhaAgora: json(planilha) };
    // C3: a diferença gravada (listas, Hoje, A receber) acompanha cada salvamento
    Object.assign(data, totaisGravados(qual === "antes" ? { ...p, planilhaAntes: json(planilha) as Prisma.JsonValue } : { ...p, planilhaAgora: json(planilha) as Prisma.JsonValue }));
    // qualquer mudança na conta desfaz a aprovação da memória
    Object.assign(data, await invalidarAprovacao(ctx, p, "Alterou a planilha"));
    await db.pedido.update({ where: { id: p.id }, data });
    return { ok: `Salvo às ${hora(new Date())}` };
  });
}

/** C1: a planilha nova do passo 3 é refeita quando a atual é trocada; exige confirmação explícita. */
function trocaDaPlanilhaAtual(p: Parameters<typeof aoTrocarPlanilhaAtual>[0], fd: FormData): { erro: string } | ReturnType<typeof aoTrocarPlanilhaAtual> {
  const t = aoTrocarPlanilhaAtual(p);
  if (t.precisaConfirmar && fd.get("refazerPlanilhaNova") !== "1")
    return { erro: "Já existe uma planilha nova no passo 3. Confirme que ela será refeita a partir desta planilha atual." };
  return t;
}

export async function enviarPlanilha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo da planilha." };
    const troca = trocaDaPlanilhaAtual(p, fd);
    if ("erro" in troca) return troca;
    // E1/E2: PDF só vai para a IA com a chave (ou para PAINEL_EMAILS) e sem CPF de pessoas; o arquivo com CPF nem é guardado
    const pdf = arquivo.name.toLowerCase().endsWith(".pdf");
    if (pdf && iaPara("PLANILHA", ctx.usuario.email) && contarCpfs(await textoDoPdf(Buffer.from(await arquivo.arrayBuffer())).catch(() => "")) > 0) return { erro: MENSAGEM_CPF };
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    const versaoPlanilha = await proximaVersao({ pedidoId: p.id }, "PLANILHA");
    await db.documento.create({ data: { pedidoId: p.id, contratoId: p.contratoId, tipo: "PLANILHA", nome: s.nome, versao: versaoPlanilha, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
    let imp;
    if (s.mime.includes("spreadsheet") || s.nome.toLowerCase().endsWith(".xlsx")) imp = await importarExcel(s.buffer);
    else if (s.mime === "application/pdf") {
      if (!iaPara("PLANILHA", ctx.usuario.email))
        return {
          erro: "O PDF foi anexado, mas a leitura automática de PDF está desligada neste ambiente. Envie a planilha em Excel ou preencha as linhas abaixo a partir do modelo.",
        };
      imp = deLeituraIa(await lerPlanilhaPdf(s.buffer));
    } else return { erro: "Envie a planilha em Excel (.xlsx) ou PDF." };
    if (!imp.planilha.tipos.length) return { erro: "Não achamos linhas de custo neste arquivo. Confira se é a planilha de custos ou preencha a partir do modelo." };
    await db.pedido.update({
      where: { id: p.id },
      data: { ...troca.data, planilhaAntes: json(imp.planilha), linhasNaoLidas: json(imp.naoLidas) },
    });
    await registrarHistorico(ctx, `Enviou a planilha atual (${s.nome})${troca.precisaConfirmar ? ": a planilha nova do passo 3 será refeita a partir dela" : ""}`, {
      pedidoId: p.id,
      contratoId: p.contratoId,
    });
    revalidatePath(`/app/pedidos/${p.id}/passo/2`);
    return { ok: `Lemos ${imp.lidas} linhas.${imp.naoLidas.length ? ` Confira as ${imp.naoLidas.length} que não entendemos.` : ""}` };
  });
}

export async function usarModelo(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const troca = trocaDaPlanilhaAtual(p, fd);
    if ("erro" in troca) return troca;
    await db.pedido.update({ where: { id: p.id }, data: { ...troca.data, planilhaAntes: json(planilhaModelo()), linhasNaoLidas: json([]) } });
    if (troca.precisaConfirmar) await registrarHistorico(ctx, "Trocou a planilha atual pelo modelo: a planilha nova do passo 3 será refeita", { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/2`);
    return { ok: "Modelo em branco criado. Preencha com os números da proposta." };
  });
}

/** Persiste a decisão sobre cada linha que a importação não conseguiu usar. */
export async function resolverPendenciaPlanilha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const id = texto(fd, "pendenciaId");
    const decisao = texto(fd, "decisao").trim();
    const status = z.enum(["CORRIGIDA", "JUSTIFICADA"]).safeParse(texto(fd, "status"));
    if (!status.success || !decisao) return { erro: "Informe se a linha foi corrigida ou justifique por que ela não se aplica." };
    const atuais = ((p.linhasNaoLidas as unknown as LinhaNaoLida[] | null) ?? []).map((x) =>
      x.id === id ? { ...x, status: status.data, decisao: decisao.slice(0, 1000) } : x,
    );
    if (!atuais.some((x) => x.id === id)) return { erro: "Pendência não encontrada." };
    await db.pedido.update({ where: { id: p.id }, data: { linhasNaoLidas: json(atuais) } });
    await registrarHistorico(ctx, `${status.data === "CORRIGIDA" ? "Corrigiu" : "Justificou"} uma linha da importação: ${decisao.slice(0, 200)}`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/2`);
    return { ok: "Decisão registrada." };
  });
}

export async function concluirPasso2(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const { p } = await pedidoEditavel(fd);
    if (!p.planilhaAntes) return { erro: "Envie a planilha atual ou comece do modelo." };
    const pendencias = ((p.linhasNaoLidas as unknown as LinhaNaoLida[] | null) ?? []).filter((x) => x.impeditiva !== false && (!x.status || x.status === "PENDENTE"));
    if (pendencias.length)
      return { erro: `Resolva as ${pendencias.length} pendências da importação antes de continuar. Corrija a linha ou registre uma justificativa.` };
    const erros = validarPlanilha(p.planilhaAntes as unknown as PlanilhaCustos);
    if (erros.length) return { erro: `Ainda há pendências na planilha: ${erros[0]}` };
    await db.pedido.update({
      where: { id: p.id },
      data: {
        passoAtual: Math.max(p.passoAtual, 3),
        planilhaAgora: p.planilhaAgora ? undefined : json(clonarPlanilha(p.planilhaAntes as unknown as PlanilhaCustos)),
      },
    });
    await registrarEvento("passo_concluido", { passo: 2 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/3`);
}

export async function concluirPasso3(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const editavel = await pedidoEditavel(fd);
    const ctx = editavel.ctx;
    let p = editavel.p;
    const cenarioAnterior = p.cenarioJornada;
    const ref = lerData(fd.get("dataReferencia")) ?? hojeUTC();
    // 5.1: no pedido da jornada, a planilha nova sai do cenário escolhido (escolha obrigatória, sem padrão)
    let jornadaDados: { cenarioJornada?: Cenario; planilhaAntes?: Prisma.InputJsonValue; planilhaAgora?: Prisma.InputJsonValue } = {};
    if (p.gatilho === "JORNADA_EC141") {
      const cen = z.enum(["MANTER_HORAS", "REDUZIR_HORAS"]).safeParse(texto(fd, "cenarioJornada"));
      if (!cen.success) return { erro: "Escolha o cenário: manter ou reduzir as horas de serviço.", campos: { cenarioJornada: "Escolha um cenário." } };
      if (!p.planilhaAntes || !p.jornadaAntes || !p.jornadaDepois) return recusarPorPendencias(p.id, pendenciasParaGerar(p, [], 3), "Antes de continuar, resolva:");
      // D2: a escolha das linhas do módulo 5 que acompanham o número de empregados fica gravada na planilha atual
      let atual = p.planilhaAntes as unknown as PlanilhaCustos;
      if (fd.get("acompanhaEditado") === "1")
        atual = {
          tipos: atual.tipos.map((t) => ({
            ...t,
            linhas: t.linhas.map((l) => (l.modulo === "M5" && l.tipo === "VALOR" ? { ...l, acompanhaEmpregados: fd.get(`acompanha:${t.id}:${l.id}`) === "on" } : l)),
          })),
        };
      jornadaDados = { cenarioJornada: cen.data, planilhaAntes: json(atual), planilhaAgora: json(planilhaDoCenario(atual, cen.data, p.jornadaAntes, p.jornadaDepois)) };
      p = { ...p, cenarioJornada: cen.data, planilhaAntes: jornadaDados.planilhaAntes as Prisma.JsonValue, planilhaAgora: jornadaDados.planilhaAgora as Prisma.JsonValue };
    }
    let retroativoCompetencias: CompetenciaRetroativo[] = [];
    try {
      const recebido = JSON.parse(texto(fd, "retroativoCompetencias") || "[]") as unknown;
      if (!Array.isArray(recebido)) throw new Error();
      retroativoCompetencias = recebido.map((linha) => {
        const item = linha as Record<string, unknown>;
        const diferencaMensal = lerDinheiro(String(item.diferencaMensal ?? ""));
        if (!diferencaMensal) throw new Error();
        return {
          competencia: String(item.competencia ?? ""),
          diferencaMensal,
          dias: Number(item.dias),
          divisor: Number(item.divisor),
          base: String(item.base ?? "") || undefined,
          periodo: String(item.periodo ?? "") || undefined,
        };
      });
    } catch {
      return { erro: "Confira as competências do retroativo. Cada linha precisa de competência, valor, dias e divisor válidos." };
    }
    const calculoManual = fd.get("calculoManual") === "on";
    const calculoManualJustificativa = texto(fd, "calculoManualJustificativa") || null;
    if (calculoManual && !calculoManualJustificativa) return { erro: "Explique por que este caso exige cálculo manual." };
    p = { ...p, retroativoCompetencias: retroativoCompetencias as unknown as Prisma.JsonValue, calculoManual, calculoManualJustificativa };
    // L11: regra do retroativo escolhida no pedido (padrão = regra original)
    const retroContarAte = z.enum(["DATA_INFORMADA", "DATA_PROTOCOLO", "DATA_APOSTILAMENTO"]).catch(p.retroContarAte).parse(texto(fd, "retroContarAte") || p.retroContarAte);
    const retroMesIncompleto = z.enum(["DIAS_CORRIDOS", "MES_30_DIAS"]).catch(p.retroMesIncompleto).parse(texto(fd, "retroMesIncompleto") || p.retroMesIncompleto);
    // C6: valores já pagos pelo órgão (descontados), última competência paga (informativa) e "regra do caso em análise"
    const pagoTxt = texto(fd, "valoresJaPagos");
    const valoresJaPagos = pagoTxt ? lerDinheiro(pagoTxt) : "0";
    if (valoresJaPagos == null || Number(valoresJaPagos) < 0) return { erro: "Confira os valores já pagos.", campos: { valoresJaPagos: "Digite um valor em reais (ou deixe em branco)." } };
    const ultimaTxt = texto(fd, "ultimaCompetenciaPaga");
    if (ultimaTxt && !/^\d{4}-\d{2}$/.test(ultimaTxt)) return { erro: "Confira a última competência paga.", campos: { ultimaCompetenciaPaga: "Use o formato AAAA-MM (ex.: 2026-03)." } };
    const retroCompararMes = fd.get("retroCompararMes") === "on";
    const calc = calcularPedido({ ...p, dataReferencia: ref, retroContarAte, retroMesIncompleto, valoresJaPagos: valoresJaPagos as never, retroCompararMes });
    const pend = pendenciasParaGerar({ ...p, dataReferencia: ref, retroContarAte, retroMesIncompleto, valoresJaPagos: valoresJaPagos as never }, [], 3);
    if (pend.length || !calc.pronto) return recusarPorPendencias(p.id, pend.length ? pend : [{ passo: 3, mensagem: calc.pendenciaRetroativo ?? "Confira o cálculo retroativo." }], "Antes de continuar, resolva:");
    const mudouPago = Number(valoresJaPagos) !== Number(p.valoresJaPagos ?? 0);
    const mudouCompetencias = JSON.stringify(retroativoCompetencias) !== JSON.stringify(Array.isArray(editavel.p.retroativoCompetencias) ? editavel.p.retroativoCompetencias : []);
    const mudouManual = calculoManual !== editavel.p.calculoManual || calculoManualJustificativa !== editavel.p.calculoManualJustificativa;
    const mudouRegra = retroContarAte !== p.retroContarAte || retroMesIncompleto !== p.retroMesIncompleto || mudouPago || mudouCompetencias || mudouManual || (!!jornadaDados.cenarioJornada && jornadaDados.cenarioJornada !== cenarioAnterior);
    const invalidar =
      p.dataReferencia?.getTime() !== ref.getTime() || mudouRegra
        ? await invalidarAprovacao(ctx, p, mudouRegra ? "Alterou a regra da diferença retroativa" : "Alterou a data até onde a diferença é contada")
        : {};
    await db.pedido.update({
      where: { id: p.id },
      data: {
        ...invalidar,
        ...jornadaDados,
        retroContarAte,
        retroMesIncompleto,
        retroCompararMes,
        retroativoCompetencias: json(retroativoCompetencias),
        calculoManual,
        calculoManualJustificativa,
        valoresJaPagos,
        ultimaCompetenciaPaga: ultimaTxt || null,
        dataReferencia: ref,
        diferencaMensal: calc.comparacao!.diferencaMensal,
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
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo." };
    const tipo = texto(fd, "tipo") || "OUTRO";
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    const versao = await proximaVersao({ pedidoId: p.id }, tipo); // 5.5: as versões anteriores ficam guardadas
    await db.documento.create({ data: { pedidoId: p.id, contratoId: p.contratoId, tipo, nome: s.nome, versao, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
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
  return tentar(async (): Promise<Resultado | void> => {
    const { p } = await pedidoEditavel(fd);
    const item = texto(fd, "item");
    const valor = texto(fd, "valor") === "ANEXADO" ? "ANEXADO" : "FALTA";
    const marcado = { ...((p.checklist as Record<string, string> | null) ?? {}), [item]: valor };
    await db.pedido.update({ where: { id: p.id }, data: { checklist: json(marcado) } });
    revalidatePath(`/app/pedidos/${p.id}/passo/4`);
  });
}

export async function concluirPasso4(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const { p } = await pedidoEditavel(fd);
    const docs = await db.documento.findMany({ where: { pedidoId: p.id } });
    const pend = pendenciasParaGerar(p, docs, 4);
    if (pend.length) return recusarPorPendencias(p.id, pend, "Sem isso, o órgão pode devolver o pedido:");
    await db.pedido.update({ where: { id: p.id }, data: { passoAtual: Math.max(p.passoAtual, 5) } });
    await registrarEvento("passo_concluido", { passo: 4 });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/passo/5`);
}

export async function gerarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const limite = limiteDoPlano(ctx.conta.plano, { tipo: "gerar_pedido" }); // 4.2
    if (limite) return { erro: limite };
    const docs = await db.documento.findMany({ where: { pedidoId: p.id } });
    const pend = pendenciasParaGerar(p, docs, 5);
    if (pend.length) return recusarPorPendencias(p.id, pend, "O pedido ainda não pode ser gerado:");
    // Monta os arquivos de verdade antes de marcar como pronto: nenhum documento quebrado chega à tela final.
    try {
      await Promise.all([oficioPdf(p.id, ctx.conta.id), planilhaXlsx(p.id, ctx.conta.id), memoriaPdf(p.id, ctx.conta.id)]);
    } catch (e) {
      console.error(e);
      return { erro: motivoFalhaDocumento(e) };
    }
    await db.pedido.update({
      where: { id: p.id },
      data: { estado: "CALCULO_VALIDADO", geradoEm: new Date(), revisaoEspecialista: revisaoEspecialistaAtiva() && fd.get("revisao") === "on", passoAtual: 5 },
    });
    await registrarHistorico(ctx, revisaoEspecialistaAtiva() && fd.get("revisao") === "on" ? "Gerou o pedido e pediu revisão de especialista" : "Gerou o pedido", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("pedido_gerado", { revisao: fd.get("revisao") === "on" });
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${texto(fd, "pedidoId")}/pronto`);
}

// ---------------------------------------------------------------------------
// Memória
// ---------------------------------------------------------------------------

export async function aprovarMemoria(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("aprovar_memoria");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (!["EM_ANALISE", "CALCULO_VALIDADO", "PROTOCOLADO", "DEFERIDO", "FATURADO"].includes(p.estado)) return { erro: "A memória não pode mais ser aprovada nesta etapa." };
    const pend = pendenciasParaGerar(p, [], 3);
    if (pend.length) return recusarPorPendencias(p.id, pend, "A memória ainda não pode ser aprovada:");
    const agora = new Date();
    const hash = hashCalculo(p);
    const snapshot = snapshotCalculo(p as never);
    await db.$transaction(async (tx) => {
      let versao = await tx.memoriaVersao.findUnique({ where: { pedidoId_hash: { pedidoId: p.id, hash } } });
      if (!versao) {
        const ultima = await tx.memoriaVersao.aggregate({ where: { pedidoId: p.id }, _max: { numero: true } });
        versao = await tx.memoriaVersao.create({ data: { pedidoId: p.id, numero: (ultima._max.numero ?? 0) + 1, hash, snapshot: json(snapshot) } });
      }
      await tx.memoriaVersao.update({ where: { id: versao.id }, data: { aprovadoPorId: ctx.usuario.id, aprovadoPorNome: ctx.usuario.nome, aprovadoEm: agora } });
      await tx.pedido.update({
        where: { id: p.id },
        data: { memoriaAprovadaEm: agora, memoriaAprovadaPor: ctx.usuario.nome, hashCalculo: hash, memoriaVersaoAtual: versao.numero, memoriaVersaoAprovadaId: versao.id },
      });
    });
    await registrarHistorico(ctx, "Aprovou a memória de cálculo", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("memoria_aprovada");
    revalidatePath(`/app/pedidos/${p.id}`, "layout");
    return { ok: "Memória aprovada." };
  });
}

export async function comentarLinha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
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
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "CALCULO_VALIDADO") return { erro: "Gere o pedido antes de registrar o protocolo." };
    const numero = texto(fd, "protocoloNumero");
    const dataP = lerData(fd.get("protocoloData"));
    const documentacaoCompletaEm = lerData(fd.get("documentacaoCompletaEm"));
    if (!numero) return { erro: "Informe o número do protocolo." };
    if (!dataP) return { erro: "Informe a data do protocolo." };
    const proposto = { ...p, protocoloData: dataP, documentacaoCompletaEm };
    const mudouCalculo = p.retroContarAte === "DATA_PROTOCOLO" && hashCalculo(proposto) !== p.hashCalculo;
    await db.$transaction(async (tx) => {
      let novaVersao: number | undefined;
      if (mudouCalculo) {
        const hash = hashCalculo(proposto);
        const ultima = await tx.memoriaVersao.aggregate({ where: { pedidoId: p.id }, _max: { numero: true } });
        const v = await tx.memoriaVersao.upsert({
          where: { pedidoId_hash: { pedidoId: p.id, hash } },
          create: { pedidoId: p.id, numero: (ultima._max.numero ?? 0) + 1, hash, snapshot: json(snapshotCalculo(proposto as never)) },
          update: {},
        });
        novaVersao = v.numero;
      }
      await tx.pedido.update({
        where: { id: p.id },
        data: {
          estado: "PROTOCOLADO",
          protocoloNumero: numero,
          protocoloData: dataP,
          documentacaoCompletaEm,
          documentacaoCompletaOrigem: documentacaoCompletaEm ? "INFORMADA_NO_PROTOCOLO" : null,
          ...(mudouCalculo ? { memoriaAprovadaEm: null, memoriaAprovadaPor: null, memoriaVersaoAprovadaId: null, memoriaVersaoAtual: novaVersao, hashCalculo: hashCalculo(proposto) } : {}),
        },
      });
    });
    if (mudouCalculo) await registrarHistorico(ctx, "A data do protocolo alterou o corte: criada nova versão da memória, pendente de revisão", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarHistorico(ctx, `Registrou o protocolo ${numero}`, { pedidoId: p.id, contratoId: p.contratoId });
    await registrarEvento("protocolo_registrado");
    await avisarProtocolo(p.id);
    revalidatePath("/app", "layout");
    return { ok: "Protocolo registrado. O pedido foi para “Aguardando o órgão”." };
  });
}

export async function registrarResposta(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "PROTOCOLADO") return { erro: "Só pedidos protocolados recebem resposta." };
    const resultado = texto(fd, "resultado");
    const dataR = lerData(fd.get("respostaData"));
    if (!dataR) return { erro: "Informe a data da resposta." };
    const resumo = texto(fd, "respostaResumo") || null;
    const evidencia = texto(fd, "decisaoEvidencia") || resumo;
    if (resultado === "INDEFERIDO") {
      await db.pedido.update({
        where: { id: p.id },
        data: { estado: "INDEFERIDO", respostaData: dataR, respostaResumo: resumo, decisaoTipo: "INDEFERIDO", decisaoEvidencia: evidencia, mensalSolicitado: null, mensalAprovado: null, retroativoAprovado: null },
      });
      await registrarHistorico(ctx, "Registrou o indeferimento", { pedidoId: p.id, contratoId: p.contratoId, detalhe: resumo ?? undefined });
    } else {
      const calc = calcularPedido(p);
      if (!calc.comparacao || !calc.retroativo) return { erro: "O cálculo do pedido não está completo." };
      const parcial = resultado === "PARCIAL" || resultado === "DEFERIDO_PARCIAL";
      const solicitadoMensal = new Decimal(calc.comparacao.mensalAgora);
      const solicitadoRetro = new Decimal(calc.retroativo.total);
      const mensalTxt = lerDinheiro(fd.get("mensalAprovado"));
      const retroTxt = lerDinheiro(fd.get("retroativoAprovado")) ?? lerDinheiro(fd.get("valorDeferido"));
      const mensalAprovado = new Decimal(parcial ? mensalTxt ?? "NaN" : mensalTxt ?? solicitadoMensal);
      const retroativoAprovado = new Decimal(parcial ? retroTxt ?? "NaN" : retroTxt ?? solicitadoRetro);
      if (!mensalAprovado.isFinite() || mensalAprovado.isNegative() || mensalAprovado.gt(solicitadoMensal)) return { erro: "O valor mensal aprovado precisa estar entre zero e o valor solicitado." };
      if (!retroativoAprovado.isFinite() || retroativoAprovado.isNegative() || retroativoAprovado.gt(solicitadoRetro)) return { erro: "O retroativo aprovado precisa estar entre zero e o valor solicitado." };
      if (parcial && !evidencia) return { erro: "No deferimento parcial, informe o fundamento ou documento da decisão." };
      await db.pedido.update({
        where: { id: p.id },
        data: {
          estado: "DEFERIDO",
          respostaData: dataR,
          deferidoEm: dataR,
          valorDeferido: retroativoAprovado.toFixed(2),
          respostaResumo: resumo,
          decisaoTipo: parcial ? "DEFERIDO_PARCIAL" : "DEFERIDO_TOTAL",
          decisaoEvidencia: evidencia,
          mensalSolicitado: solicitadoMensal.toFixed(2),
          mensalAprovado: mensalAprovado.toFixed(2),
          mensalVigenteAnterior: p.contrato.valorMensal,
          retroativoAprovado: retroativoAprovado.toFixed(2),
          conciliacaoPendente: false,
        },
      });
      await registrarHistorico(ctx, parcial ? "Registrou o deferimento parcial" : "Registrou o deferimento total", {
        pedidoId: p.id,
        contratoId: p.contratoId,
        detalhe: `Mensal solicitado ${solicitadoMensal.toFixed(2)}; aprovado ${mensalAprovado.toFixed(2)}; retroativo aprovado ${retroativoAprovado.toFixed(2)}.`,
      });
      await avisarDeferido(p.id);
    }
    await registrarEvento("resposta_registrada", { resultado: resultado === "INDEFERIDO" ? "indeferido" : "deferido" });
    revalidatePath("/app", "layout");
    return { ok: "Resposta registrada." };
  });
}

export async function registrarApostilamento(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "DEFERIDO") return { erro: "O apostilamento vem depois do deferimento." };
    const d = lerData(fd.get("apostiladoEm"));
    if (!d) return { erro: "Informe a data do apostilamento." };
    const calc = calcularPedido(p);
    const mensalAprovado = p.mensalAprovado?.toString() ?? calc.comparacao?.mensalAgora;
    if (!mensalAprovado) return { erro: "A decisão não informa o valor mensal aprovado." };
    const proposto = { ...p, apostiladoEm: d };
    const mudouCalculo = p.retroContarAte === "DATA_APOSTILAMENTO" && hashCalculo(proposto) !== p.hashCalculo;
    await db.$transaction(async (tx) => {
      let novaVersao: number | undefined;
      if (mudouCalculo) {
        const hash = hashCalculo(proposto);
        const ultima = await tx.memoriaVersao.aggregate({ where: { pedidoId: p.id }, _max: { numero: true } });
        const v = await tx.memoriaVersao.upsert({
          where: { pedidoId_hash: { pedidoId: p.id, hash } },
          create: { pedidoId: p.id, numero: (ultima._max.numero ?? 0) + 1, hash, snapshot: json(snapshotCalculo(proposto as never)) },
          update: {},
        });
        novaVersao = v.numero;
      }
      await tx.pedido.update({
        where: { id: p.id },
        data: {
          apostiladoEm: d,
          ...(mudouCalculo ? { memoriaAprovadaEm: null, memoriaAprovadaPor: null, memoriaVersaoAprovadaId: null, memoriaVersaoAtual: novaVersao, hashCalculo: hashCalculo(proposto) } : {}),
        },
      });
      await tx.valorMensalContrato.create({
        data: {
          contratoId: p.contratoId,
          pedidoId: p.id,
          valorAnterior: p.contrato.valorMensal,
          valorNovo: mensalAprovado,
          ato: "APOSTILAMENTO",
          evidencia: p.decisaoEvidencia,
          aplicavelEm: d,
          registradoPor: ctx.usuario.nome,
        },
      });
      await tx.contrato.update({ where: { id: p.contratoId }, data: { ultimoApostilamento: d, valorMensal: mensalAprovado } });
    });
    if (mudouCalculo) await registrarHistorico(ctx, "A data do apostilamento alterou o corte: criada nova versão da memória, pendente de revisão", { pedidoId: p.id, contratoId: p.contratoId });
    await registrarHistorico(ctx, "Registrou o apostilamento", { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath("/app", "layout");
    return { ok: "Apostilamento registrado." };
  });
}

const atualizouIdentificacao = (e: Prisma.PrismaClientKnownRequestError) => JSON.stringify(e.meta ?? {}).includes("identificacao");

/** "Registrar nota fiscal": registra uma nota já emitida contra o retroativo aprovado (parcial, idempotente). */
export async function gerarCobranca(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (!["DEFERIDO", "FATURADO"].includes(p.estado)) return { erro: "Só valores deferidos podem ser faturados." };
    if (!p.apostiladoEm) return { erro: "Registre o apostilamento antes de faturar. Sem ele, o órgão não paga a diferença." };
    const nf = texto(fd, "notaFiscal");
    const d = lerData(fd.get("faturadoEm"));
    const valor = lerDinheiro(fd.get("valorNota")) ?? lerDinheiro(fd.get("valorDeferido"));
    const referencia = texto(fd, "referenciaOperacao") || `${nf}:${d?.toISOString() ?? ""}:${valor ?? ""}`;
    if (!nf || !d || !valor) return { erro: "Informe o número, a data e o valor da nota fiscal da diferença." };
    const registrar = () =>
      db.$transaction(async (tx): Promise<{ repetida: boolean; nota: NotaFiscalPedido }> => {
        const atual = await tx.pedido.findUnique({ where: { id: p.id }, include: { notasFiscais: true, baixas: true } });
        if (!atual) throw new ErroUsuario("Pedido não encontrado.");
        const repetida = atual.notasFiscais.find((n) => n.referenciaOperacao === referencia);
        if (repetida) return { repetida: true, nota: repetida };
        if (atual.notasFiscais.some((n) => n.identificacao === nf && !n.canceladaEm)) throw new ErroUsuario("Já existe uma nota fiscal ativa com esta identificação.");
        const resumoAtual = resumoFinanceiro(atual.retroativoAprovado ?? atual.valorDeferido ?? 0, atual.notasFiscais, atual.baixas);
        const confirmado = validarLancamento(valor, resumoAtual.faltaFaturar, "O valor da nota");
        const nota = await tx.notaFiscalPedido.create({
          data: { pedidoId: p.id, identificacao: nf, emitidaEm: d, valor: confirmado, referenciaOperacao: referencia, evidencia: texto(fd, "evidenciaNota") || null, criadoPor: ctx.usuario.nome },
        });
        await tx.pedido.update({ where: { id: p.id }, data: { estado: "FATURADO", notaFiscal: nf, faturadoEm: d } });
        return { repetida: false, nota };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    let resultado: { repetida: boolean; nota: NotaFiscalPedido } | null = null;
    // Serializable: duas notas concorrentes não passam juntas do saldo; conflito (P2034) tenta de novo
    for (let tentativa = 0; tentativa < 3 && !resultado; tentativa++) {
      try {
        resultado = await registrar();
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const nota = await db.notaFiscalPedido.findUnique({ where: { pedidoId_referenciaOperacao: { pedidoId: p.id, referenciaOperacao: referencia } } });
          if (nota) {
            resultado = { repetida: true, nota };
            break;
          }
          if (atualizouIdentificacao(e)) throw new ErroUsuario("Já existe uma nota fiscal com esta identificação.");
        }
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2034" || tentativa === 2) throw e;
      }
    }
    if (!resultado) throw new ErroUsuario("Não foi possível registrar a nota agora.");
    if (!resultado.repetida) await registrarHistorico(ctx, `Faturou R$ ${resultado.nota.valor.toString()} da diferença (NF ${nf})`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath("/app", "layout");
    return { ok: resultado.repetida ? "Esta nota já havia sido registrada; nenhum valor foi duplicado." : "Nota fiscal registrada." };
  });
}

export async function marcarRecebido(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("registrar_financeiro");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "FATURADO") return { erro: "Registre a fatura da diferença antes de marcar como recebido." };
    const d = lerData(fd.get("recebidoEm"));
    const valor = lerDinheiro(fd.get("valorRecebido"));
    if (!d || !valor) return { erro: "Informe a data e o valor recebido." };
    const notaInformada = texto(fd, "notaFiscalId");
    const referencia = texto(fd, "referenciaOperacao") || `${notaInformada}:${d.toISOString()}:${valor}`;
    let retorno: { repetida: boolean; quitado: boolean; totalPendente: string } | null = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        retorno = await db.$transaction(
          async (tx) => {
            const atual = await tx.pedido.findUnique({
              where: { id: p.id },
              include: { notasFiscais: { where: { canceladaEm: null }, orderBy: { emitidaEm: "asc" } }, baixas: { where: { canceladaEm: null } } },
            });
            if (!atual) throw new ErroUsuario("Pedido não encontrado.");
            const existente = atual.baixas.find((b) => b.referenciaOperacao === referencia);
            const resumoAntes = resumoFinanceiro(atual.retroativoAprovado ?? atual.valorDeferido ?? 0, atual.notasFiscais, atual.baixas);
            if (existente) return { repetida: true, quitado: resumoAntes.quitado, totalPendente: resumoAntes.totalPendente };
            const nota = notaInformada
              ? atual.notasFiscais.find((n) => n.id === notaInformada)
              : atual.notasFiscais.find((n) => {
                  const pago = atual.baixas.filter((b) => b.notaFiscalId === n.id).reduce((s, b) => s.plus(b.valor), new Decimal(0));
                  return pago.lt(n.valor);
                });
            if (!nota) throw new ErroUsuario("Escolha uma nota fiscal com saldo a receber.");
            const pagoNota = atual.baixas.filter((b) => b.notaFiscalId === nota.id).reduce((s, b) => s.plus(b.valor), new Decimal(0));
            const confirmado = validarLancamento(valor, new Decimal(nota.valor).minus(pagoNota), "O recebimento");
            const baixa = await tx.baixaPedido.create({
              data: { pedidoId: p.id, notaFiscalId: nota.id, recebidoEm: d, valor: confirmado, referenciaOperacao: referencia, autorId: ctx.usuario.id, autorNome: ctx.usuario.nome },
            });
            const resumoDepois = resumoFinanceiro(atual.retroativoAprovado ?? atual.valorDeferido ?? 0, atual.notasFiscais, [...atual.baixas, baixa]);
            await tx.pedido.update({ where: { id: p.id }, data: { estado: resumoDepois.quitado ? "RECEBIDO" : "FATURADO", recebidoEm: d, valorRecebido: resumoDepois.recebido } });
            return { repetida: false, quitado: resumoDepois.quitado, totalPendente: resumoDepois.totalPendente };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const atual = await db.pedido.findUnique({ where: { id: p.id }, include: { notasFiscais: { where: { canceladaEm: null } }, baixas: { where: { canceladaEm: null } } } });
          const existente = atual?.baixas.find((b) => b.referenciaOperacao === referencia);
          if (atual && existente) {
            const resumo = resumoFinanceiro(atual.retroativoAprovado ?? atual.valorDeferido ?? 0, atual.notasFiscais, atual.baixas);
            retorno = { repetida: true, quitado: resumo.quitado, totalPendente: resumo.totalPendente };
            break;
          }
        }
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2034" || tentativa === 2) throw e;
      }
    }
    if (!retorno) throw new ErroUsuario("Não foi possível registrar o recebimento agora.");
    if (!retorno.repetida)
      await registrarHistorico(ctx, `Registrou recebimento parcial de R$ ${valor}`, { pedidoId: p.id, contratoId: p.contratoId, detalhe: `Saldo total pendente: R$ ${retorno.totalPendente}.` });
    if (retorno.quitado && !retorno.repetida) await registrarEvento("diferenca_recebida");
    revalidatePath("/app", "layout");
    return { ok: retorno.repetida ? "Esta baixa já havia sido registrada; nenhum valor foi duplicado." : retorno.quitado ? "Recebido integralmente. O pedido saiu da lista." : `Recebimento parcial registrado. Ainda faltam R$ ${retorno.totalPendente}.` };
  });
}

export async function descartarPedido(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    // L6: banco primeiro (documentos do pedido saem em cascata), depois só os arquivos deste pedido
    const docs = await db.documento.findMany({ where: { pedidoId: p.id }, select: { caminho: true } });
    await db.pedido.delete({ where: { id: p.id } });
    for (const d of docs) await apagarArquivo(d.caminho).catch((e) => console.error("[descartar] arquivo não apagado", d.caminho, e));
    await registrarHistorico(ctx, `Descartou o pedido de repactuação iniciado em ${dataLocal(p.criadoEm)}${docs.length ? ` (${docs.length} anexo${docs.length > 1 ? "s" : ""} apagado${docs.length > 1 ? "s" : ""})` : ""}`, { contratoId: p.contratoId });
  });
  if (r.erro) return r;
  redirect("/app/pedidos");
}

// ---------------------------------------------------------------------------
// 5.5: depois do indeferimento
// ---------------------------------------------------------------------------

/** Registra o recurso: data em que foi apresentado (se já foi) e o prazo, que entra nos prazos e no histórico. */
export async function registrarRecurso(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const p = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (p.estado !== "INDEFERIDO") return { erro: "O recurso é para pedidos indeferidos." };
    const recursoData = lerData(fd.get("recursoData"));
    const recursoPrazo = lerData(fd.get("recursoPrazo"));
    if (!recursoPrazo) return { erro: "Falta o prazo do recurso.", campos: { recursoPrazo: "Digite o prazo do recurso." } };
    if (p.respostaData && recursoData && recursoData < p.respostaData) return { erro: "A data do recurso é anterior ao indeferimento.", campos: { recursoData: "Confira a data." } };
    await db.pedido.update({ where: { id: p.id }, data: { recursoData, recursoPrazo } });
    await registrarHistorico(ctx, recursoData ? `Registrou o recurso, apresentado em ${data(recursoData)}, prazo ${data(recursoPrazo)}` : `Registrou o prazo do recurso: ${data(recursoPrazo)}`, {
      pedidoId: p.id,
      contratoId: p.contratoId,
    });
    revalidatePath(`/app/pedidos/${p.id}/pronto`);
    return { ok: "Recurso registrado. O prazo aparece em Hoje e no contrato." };
  });
}

/** Começa um novo pedido a partir de um indeferido: reaproveita as planilhas, o motivo e cópias dos documentos. */
export async function novoPedidoAPartirDe(_: Resultado, fd: FormData): Promise<Resultado> {
  let novoId = "";
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const o = await pedidoDaConta(ctx, texto(fd, "pedidoId"));
    if (o.estado !== "INDEFERIDO") return { erro: "Só um pedido indeferido pode ser refeito a partir dele." };
    const aberto = await db.pedido.findFirst({ where: { contratoId: o.contratoId, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] }, pedidoOrigemId: o.id } });
    if (aberto) {
      novoId = aberto.id;
      return;
    }
    const docs = await db.documento.findMany({ where: { pedidoId: o.id } });
    const novo = await db.pedido.create({
      data: {
        contratoId: o.contratoId,
        pedidoOrigemId: o.id,
        gatilho: o.gatilho,
        convencaoId: o.convencaoId,
        dataBase: o.dataBase,
        dataDeposito: o.dataDeposito,
        descricaoGatilho: o.descricaoGatilho,
        jornadaAntes: o.jornadaAntes,
        jornadaDepois: o.jornadaDepois,
        horasCobertura: o.horasCobertura,
        inicioJornada: o.inicioJornada,
        cenarioJornada: o.cenarioJornada,
        retroContarAte: o.retroContarAte,
        retroMesIncompleto: o.retroMesIncompleto,
        planilhaAntes: o.planilhaAntes ? json(o.planilhaAntes) : undefined,
        planilhaAgora: o.planilhaAgora ? json(o.planilhaAgora) : undefined,
        checklist: o.checklist ? json(o.checklist) : undefined,
        passoAtual: o.planilhaAgora ? 3 : o.planilhaAntes ? 2 : 1,
      },
    });
    // cópia de cada arquivo: descartar o pedido novo não pode apagar os arquivos do indeferido
    for (const d of docs) {
      try {
        const buf = await lerArquivo(d.caminho);
        const caminho = `${ctx.conta.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(d.caminho)}`;
        await gravarArquivo(caminho, buf, d.mime);
        await db.documento.create({ data: { pedidoId: novo.id, contratoId: d.contratoId, tipo: d.tipo, nome: d.nome, versao: d.versao, mime: d.mime, tamanho: d.tamanho, caminho, enviadoPor: d.enviadoPor } });
      } catch (e) {
        console.error("[novo pedido] arquivo não copiado", d.caminho, e);
      }
    }
    await registrarHistorico(ctx, "Começou um novo pedido a partir do indeferido", { pedidoId: o.id, contratoId: o.contratoId });
    await registrarHistorico(ctx, "Pedido criado a partir de um pedido indeferido (planilhas e documentos reaproveitados)", { pedidoId: novo.id, contratoId: o.contratoId });
    await registrarEvento("pedido_iniciado", { emLote: false });
    novoId = novo.id;
  });
  if (r.erro) return r;
  redirect(`/app/pedidos/${novoId}`);
}

// ---------------------------------------------------------------------------
// 5.5: leitura da convenção com IA (sugere; a pessoa confirma linha a linha)
// ---------------------------------------------------------------------------

/** Envia o PDF da convenção; a IA sugere o valor novo de cada linha que a convenção define. Nada muda na planilha ainda. */
export async function lerConvencaoComIa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    if (!iaPara("CONVENCAO", ctx.usuario.email)) return { erro: "A leitura com IA não está ligada. Atualize as linhas à mão." };
    if (!p.planilhaAgora) return { erro: "Conclua o passo 2 antes." };
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o PDF da convenção." };
    // E2: convenção com CPF de pessoas (ex.: lista de dirigentes ou de empregados) não vai para a IA
    if (contarCpfs(await textoDoPdf(Buffer.from(await arquivo.arrayBuffer())).catch(() => "")) > 0) return { erro: MENSAGEM_CPF };
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    if (s.mime !== "application/pdf") return { erro: "Envie a convenção em PDF." };
    const doc = await db.documento.create({
      data: {
        pedidoId: p.id,
        contratoId: p.contratoId,
        convencaoId: p.convencaoId,
        tipo: "CONVENCAO",
        nome: s.nome,
        versao: await proximaVersao({ pedidoId: p.id }, "CONVENCAO"),
        mime: s.mime,
        tamanho: s.tamanho,
        caminho: s.caminho,
        enviadoPor: ctx.usuario.nome,
      },
    });
    const linhas = linhasParaConvencao(p.planilhaAgora as unknown as PlanilhaCustos);
    const leitura = await lerConvencaoPdf(s.buffer, linhas);
    const itens = filtrarSugestoes(leitura, linhas);
    const sugestoes: SugestoesConvencao = { documentoId: doc.id, lidoEm: new Date().toISOString(), observacoes: leitura.observacoes.slice(0, 1000), itens };
    const checklist = { ...((p.checklist as Record<string, string> | null) ?? {}), convencao_nova: "ANEXADO" };
    await db.pedido.update({ where: { id: p.id }, data: { sugestoesConvencao: json(sugestoes), checklist: json(checklist) } });
    await registrarHistorico(ctx, `Leu a convenção ${s.nome} com IA: ${itens.length} sugestões para conferir`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/3`);
    return { ok: itens.length ? `${itens.length} sugestões para conferir.` : "A leitura não achou valores para as linhas da planilha. Atualize à mão." };
  });
}

/** Aplica só as linhas que a pessoa marcou, com o valor que ela confirmou (pode corrigir). */
export async function aplicarSugestoesConvencao(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { ctx, p } = await pedidoEditavel(fd);
    const sug = p.sugestoesConvencao as unknown as SugestoesConvencao | null;
    if (!sug || !p.planilhaAgora) return { erro: "Não há sugestões para aplicar." };
    const confirmadas: { postoId: string; linhaId: string; valor: string; fonte: string }[] = [];
    const campos: Record<string, string> = {};
    for (const it of sug.itens) {
      const k = `${it.postoId}:${it.linhaId}`;
      if (fd.get(`ok:${k}`) !== "on") continue;
      const valor = normalizarNumero(texto(fd, `valor:${k}`) || it.valorNovo);
      if (valor == null) {
        campos[`valor:${k}`] = "Digite um número.";
        continue;
      }
      confirmadas.push({ postoId: it.postoId, linhaId: it.linhaId, valor, fonte: fonteDaSugestao(it.clausula, it.pagina) });
    }
    if (Object.keys(campos).length) return { erro: "Confira os valores marcados.", campos };
    if (!confirmadas.length) return { erro: "Marque as linhas que você conferiu na convenção." };
    const { planilha } = aplicarConfirmadas(p.planilhaAgora as unknown as PlanilhaCustos, confirmadas);
    const restantes = sug.itens.filter((it) => !confirmadas.some((c) => c.postoId === it.postoId && c.linhaId === it.linhaId));
    const data: Prisma.PedidoUpdateInput = {
      planilhaAgora: json(planilha),
      sugestoesConvencao: restantes.length ? json({ ...sug, itens: restantes }) : Prisma.DbNull,
      ...totaisGravados({ ...p, planilhaAgora: json(planilha) as Prisma.JsonValue }),
      ...(await invalidarAprovacao(ctx, p, "Confirmou valores lidos da convenção")),
    };
    await db.pedido.update({ where: { id: p.id }, data });
    await registrarHistorico(ctx, `Confirmou ${confirmadas.length} ${confirmadas.length === 1 ? "linha lida" : "linhas lidas"} da convenção (fonte: cláusula e página)`, { pedidoId: p.id, contratoId: p.contratoId });
    revalidatePath(`/app/pedidos/${p.id}/passo/3`);
    return { ok: `${confirmadas.length} ${confirmadas.length === 1 ? "linha atualizada" : "linhas atualizadas"}.` };
  });
}

export async function descartarSugestoesConvencao(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const { p } = await pedidoEditavel(fd);
    await db.pedido.update({ where: { id: p.id }, data: { sugestoesConvencao: Prisma.DbNull } });
    revalidatePath(`/app/pedidos/${p.id}/passo/3`);
    return { ok: "Sugestões descartadas." };
  });
}
