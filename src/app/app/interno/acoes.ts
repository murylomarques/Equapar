"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { ErroUsuario, tentar, texto, type Resultado } from "@/lib/acao";
import { lerData } from "@/lib/format";
import { podeVerPainel, TIPOS_TEMPO } from "@/lib/metricas";

/** Só quem está em PAINEL_EMAILS mexe no painel interno. */
async function donoDoPainel() {
  const ctx = await contexto();
  if (!podeVerPainel(ctx.usuario.email)) throw new ErroUsuario("Página não encontrada.");
  return ctx;
}

const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", ".")));

/** 5.4: custo de aquisição e margem do mês, informados pelo dono. Campo vazio apaga o número. */
export async function salvarMetricaMensal(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    await donoDoPainel();
    const mes = texto(fd, "mes");
    if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Mês inválido." };
    const custo = numero(texto(fd, "custoAquisicao"));
    const margem = numero(texto(fd, "margemPct"));
    if (custo != null && !(custo >= 0)) return { erro: "Custo de aquisição inválido.", campos: { custoAquisicao: "Digite um valor em reais." } };
    if (margem != null && !(margem >= -100 && margem <= 100)) return { erro: "Margem inválida.", campos: { margemPct: "Digite uma porcentagem entre -100 e 100." } };
    const data = { custoAquisicao: custo == null ? null : custo.toFixed(2), margemPct: margem == null ? null : margem.toFixed(2) };
    await db.metricaMensal.upsert({ where: { mes }, create: { mes, ...data }, update: data });
    revalidatePath("/app/interno");
    return { ok: "Números do mês salvos." };
  });
}

/** 5.5: minutos de trabalho humano gastos com um cliente. */
export async function registrarTempo(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await donoDoPainel();
    const contaId = texto(fd, "contaId");
    const tipo = z.enum(Object.keys(TIPOS_TEMPO) as [keyof typeof TIPOS_TEMPO]).safeParse(texto(fd, "tipo"));
    const minutos = Number(texto(fd, "minutos"));
    const data = lerData(fd.get("data"));
    const campos: Record<string, string> = {};
    if (!contaId || !(await db.conta.findUnique({ where: { id: contaId }, select: { id: true } }))) campos.contaId = "Escolha o cliente.";
    if (!tipo.success) campos.tipo = "Escolha o tipo de trabalho.";
    if (!(Number.isInteger(minutos) && minutos > 0 && minutos <= 1440)) campos.minutos = "Digite os minutos (1 a 1440).";
    if (!data) campos.data = "Digite a data.";
    if (Object.keys(campos).length) return { erro: "Confira os campos.", campos };
    await db.registroTempo.create({ data: { contaId, tipo: tipo.data!, minutos, data: data!, descricao: texto(fd, "descricao").slice(0, 300) || null, registradoPor: ctx.usuario.nome } });
    revalidatePath("/app/interno");
    return { ok: "Tempo registrado." };
  });
}
