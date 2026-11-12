"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cnpjValido, formatarCnpj, soDigitos } from "@/lib/cnpj";
import { assinar } from "@/lib/cripto";
import { registrarEvento } from "@/lib/eventos";
import { appUrl, enviar } from "@/lib/mensagens";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";
import { normalizarTelefoneBR } from "@/lib/telefone";

import type { Resultado } from "@/lib/acao";

export type EstadoForm = Resultado;

const esquema = z.object({
  cnpj: z.string().transform(soDigitos).refine(cnpjValido, "CNPJ inválido."),
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido, como nome@empresa.com.br."),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizarTelefoneBR(v) !== null, "Digite o WhatsApp com DDD, por exemplo (27) 99999-0000.")
    .transform((v) => (v === "" ? "" : normalizarTelefoneBR(v)!)),
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
    return { campos: erros };
  }
  const { cnpj, email, whatsapp, consentimento } = p.data;
  if (whatsapp && !consentimento) return { campos: { consentimento: "Para receber avisos no WhatsApp, marque a autorização." } };

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
  return { ok: "Relatório enviado.", dados: { link } };
}

/** PNCP fora do ar: guarda o e-mail, tenta de novo com prazo maior e manda o link se conseguir. */
export async function avisarDepois(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const cnpj = soDigitos(String(fd.get("cnpj") ?? ""));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!cnpjValido(cnpj)) return { erro: "Esse CNPJ não existe. Confira os 14 números." };
  if (!z.string().email().safeParse(email).success) return { campos: { email: "Digite um e-mail válido, como nome@empresa.com.br." } };
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
    return { ok: "Pronto. A consulta terminou e mandamos o link para o seu e-mail." };
  } catch (e) {
    if (e instanceof PncpIndisponivel) return { ok: "Guardamos seu e-mail, mas o PNCP segue fora do ar. Tente de novo mais tarde." };
    throw e;
  }
}
