"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cnpjValido, formatarCnpj, soDigitos } from "@/lib/cnpj";
import { assinar } from "@/lib/cripto";
import { registrarEvento } from "@/lib/eventos";
import { appUrl, enviar } from "@/lib/mensagens";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";

export interface EstadoForm {
  ok?: boolean;
  erro?: string;
  erros?: Record<string, string>;
  link?: string;
}

const esquema = z.object({
  cnpj: z.string().transform(soDigitos).refine(cnpjValido, "CNPJ inválido."),
  email: z.string().trim().toLowerCase().email("Confira o e-mail: falta o @ ou o domínio."),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Confira o WhatsApp: use DDD e número."),
  consentimento: z.boolean(),
});

function linkRelatorio(cnpj: string) {
  const t = assinar(`raiox:${cnpj}`);
  return `/api/raio-x/relatorio?t=${encodeURIComponent(t)}`;
}

export async function pedirRelatorio(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const p = esquema.safeParse({
    cnpj: String(fd.get("cnpj") ?? ""),
    email: String(fd.get("email") ?? ""),
    whatsapp: String(fd.get("whatsapp") ?? ""),
    consentimento: fd.get("consentimento") === "on",
  });
  if (!p.success) {
    const erros: Record<string, string> = {};
    for (const i of p.error.issues) erros[String(i.path[0])] = i.message;
    return { erros };
  }
  const { cnpj, email, whatsapp, consentimento } = p.data;
  if (whatsapp && !consentimento) return { erros: { consentimento: "Para receber avisos no WhatsApp, marque a autorização." } };

  await db.lead.create({ data: { cnpj, email, whatsapp: consentimento && whatsapp ? whatsapp : null, consentimentoAvisos: consentimento } });
  await registrarEvento("relatorio_pedido", { comWhatsapp: !!whatsapp });

  const link = linkRelatorio(cnpj);
  await enviar({
    contaId: null,
    chave: `RAIOX:${cnpj}:${new Date().toISOString().slice(0, 10)}`,
    tipo: "RAIOX",
    canal: "EMAIL",
    destino: email,
    assunto: `Seu Raio-X dos contratos públicos (CNPJ ${formatarCnpj(cnpj)})`,
    corpo: `Olá. Aqui está o relatório do Raio-X com os contratos vigentes no PNCP e os prazos de cada um: ${appUrl(link)}\n\nPara montar o pedido de repactuação com memória de cálculo, crie sua conta: ${appUrl(`/criar-conta?cnpj=${cnpj}`)}\n\nVocê recebeu esta mensagem porque pediu o relatório no site da Equapar.`,
  });
  return { ok: true, link };
}

/** PNCP fora do ar: guarda o e-mail, tenta de novo com prazo maior e manda o link se conseguir. */
export async function avisarDepois(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const cnpj = soDigitos(String(fd.get("cnpj") ?? ""));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!cnpjValido(cnpj)) return { erro: "CNPJ inválido." };
  if (!z.string().email().safeParse(email).success) return { erros: { email: "Confira o e-mail: falta o @ ou o domínio." } };
  await db.lead.create({ data: { cnpj, email, consentimentoAvisos: false } });
  try {
    await consultarPncp(cnpj, { semCache: true, timeoutMs: 30_000 });
    await enviar({
      contaId: null,
      chave: `RAIOX:${cnpj}:${new Date().toISOString().slice(0, 10)}`,
      tipo: "RAIOX",
      canal: "EMAIL",
      destino: email,
      assunto: `A consulta ao PNCP terminou (CNPJ ${formatarCnpj(cnpj)})`,
      corpo: `A consulta terminou. Veja os contratos e prazos: ${appUrl(`/raio-x?cnpj=${cnpj}`)}`,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof PncpIndisponivel) return { ok: true, erro: "Guardamos seu e-mail. O PNCP segue fora do ar; tente de novo mais tarde." };
    throw e;
  }
}
