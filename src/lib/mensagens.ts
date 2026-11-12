/**
 * Envio de e-mail e WhatsApp.
 * Sem credenciais no .env = MODO SIMULAÇÃO: nada sai da máquina; a mensagem é gravada
 * com status SIMULADO e aparece em Configurações > Caixa de saída.
 * (Sem "server-only" de propósito: também roda no script de avisos.)
 */
import type { CanalAviso, StatusAviso } from "@prisma/client";
import { db } from "./db";
import { normalizarTelefoneBR } from "./telefone";
import { ErroUsuario } from "./acao";

export function emailAtivo() {
  return !!process.env.SMTP_URL;
}
export function whatsappAtivo() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function appUrl(caminho = "") {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${caminho}`;
}

// ---------------------------------------------------------------------------
// Modelos (Produto e experiência, "Modelos de aviso") — categoria "utilidade":
// sempre citam o contrato específico e não misturam propaganda.
// ---------------------------------------------------------------------------

export type ModeloWhatsapp = "equapar_prazo_60" | "equapar_prazo_30" | "equapar_prazo_7" | "equapar_prazo_resposta" | "equapar_deferido";

export const MODELOS: Record<ModeloWhatsapp, (p: Record<string, string>) => string> = {
  equapar_prazo_60: (p) =>
    `Equapar: o contrato ${p.numero} com ${p.orgao} termina em ${p.data}. Se a convenção de ${p.ano} já foi depositada, o pedido de repactuação precisa sair antes da prorrogação. Ver o que falta: ${p.link}`,
  equapar_prazo_30: (p) => `Equapar: faltam 30 dias para o fim do contrato ${p.numero} (${p.orgao}). Situação do pedido: ${p.situacao}. Abrir: ${p.link}`,
  equapar_prazo_7: (p) =>
    `Equapar: faltam 7 dias para o fim do contrato ${p.numero} (${p.orgao}). Se o pedido não sair antes da assinatura, registre a ressalva no termo aditivo. Modelo de texto: ${p.link}`,
  equapar_prazo_resposta: (p) =>
    `Equapar: o pedido do contrato ${p.numero} foi protocolado em ${p.dataProtocolo}. O prazo preferencial de resposta do órgão termina em ${p.dataResposta}. Ver pedido: ${p.link}`,
  equapar_deferido: (p) => `Equapar: o pedido do contrato ${p.numero} foi marcado como deferido. Próximo passo: apostilamento e fatura da diferença. ${p.link}`,
};

/** Ordem dos parâmetros nos modelos aprovados na Meta (corpo com {{1}}, {{2}}, ...). */
const PARAMS: Record<ModeloWhatsapp, string[]> = {
  equapar_prazo_60: ["numero", "orgao", "data", "ano", "link"],
  equapar_prazo_30: ["numero", "orgao", "situacao", "link"],
  equapar_prazo_7: ["numero", "orgao", "link"],
  equapar_prazo_resposta: ["numero", "dataProtocolo", "dataResposta", "link"],
  equapar_deferido: ["numero", "link"],
};

// ---------------------------------------------------------------------------
// Envio + registro (idempotente pela chave)
// ---------------------------------------------------------------------------

interface Envio {
  contaId: string | null;
  contratoId?: string | null;
  chave: string;
  tipo: string;
  canal: CanalAviso;
  destino: string;
  assunto?: string;
  corpo: string;
  html?: string;
  modelo?: { nome: ModeloWhatsapp; params: Record<string, string> };
}

async function enviarEmail(para: string, assunto: string, texto: string, html?: string) {
  const nodemailer = await import("nodemailer");
  const t = nodemailer.createTransport(process.env.SMTP_URL!);
  await t.sendMail({ from: process.env.EMAIL_FROM ?? "Equapar Avisos <avisos@equapar.com.br>", to: para, subject: assunto, text: texto, html });
}

async function enviarWhatsapp(para: string, modelo: ModeloWhatsapp, params: Record<string, string>) {
  // C5: a Meta lê os primeiros dígitos como código do país; sem o 55, "27…" ia para outro país.
  const destino = normalizarTelefoneBR(para);
  if (!destino) throw new ErroUsuario("Número de WhatsApp inválido. Confira o DDD e o número.");
  const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino.slice(1),
      type: "template",
      template: {
        name: modelo,
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: PARAMS[modelo].map((k) => ({ type: "text", text: params[k] ?? "" })) }],
      },
    }),
  });
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

/** Envia (ou simula) e registra. Retorna null se a mesma chave já foi enviada a esse destino. */
export async function enviar(e: Envio) {
  const ja = await db.aviso.findUnique({ where: { chave_canal_destino: { chave: e.chave, canal: e.canal, destino: e.destino } } });
  if (ja) return null;

  const aviso = await db.aviso.create({
    data: {
      contaId: e.contaId,
      contratoId: e.contratoId ?? null,
      chave: e.chave,
      tipo: e.tipo,
      canal: e.canal,
      destino: e.destino,
      assunto: e.assunto,
      corpo: e.corpo,
      status: "SIMULADO",
    },
  });

  // Links rastreados (aviso_clicado) e pixel de abertura (aviso_aberto); sem dado pessoal nos eventos.
  const corpo = e.corpo.replace(/(https?:\/\/[^\s]+)/g, (u) => appUrl(`/r/${aviso.id}?para=${encodeURIComponent(u.replace(appUrl(), ""))}`));
  let status: StatusAviso = "SIMULADO";
  let erro: string | null = null;
  // C6: demonstração nunca envia mensagem de verdade (simulação forçada)
  const demo = e.destino.endsWith("@demo.equapar.local") || (!!e.contaId && !!(await db.conta.findUnique({ where: { id: e.contaId }, select: { demo: true } }))?.demo);
  try {
    if (demo) {
      console.info(`[aviso SIMULADO: demonstração] ${e.canal}`);
    } else if (e.canal === "EMAIL" && emailAtivo()) {
      const pixel = `<img src="${appUrl(`/api/avisos/${aviso.id}/aberto`)}" width="1" height="1" alt="">`;
      await enviarEmail(e.destino, e.assunto ?? "Equapar", corpo, (e.html ?? `<pre style="font-family:inherit;white-space:pre-wrap">${escaparHtml(corpo)}</pre>`) + pixel);
      status = "ENVIADO";
    } else if (e.canal === "WHATSAPP" && whatsappAtivo() && e.modelo) {
      const params = { ...e.modelo.params, link: appUrl(`/r/${aviso.id}?para=${encodeURIComponent((e.modelo.params.link ?? "").replace(appUrl(), ""))}`) };
      await enviarWhatsapp(e.destino, e.modelo.nome, params);
      status = "ENVIADO";
    } else {
      console.info(`[aviso SIMULADO] ${e.canal} → ${e.destino}\n${e.assunto ? e.assunto + "\n" : ""}${corpo}\n`);
    }
  } catch (err) {
    status = "ERRO";
    erro = (err as Error).message;
    console.error("[aviso ERRO]", erro);
  }
  const atual = await db.aviso.update({ where: { id: aviso.id }, data: { status, erro, corpo } });
  await db.evento.create({ data: { nome: "aviso_enviado", props: { tipo: e.tipo, canal: e.canal, status } } });
  return atual;
}

export function escaparHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
