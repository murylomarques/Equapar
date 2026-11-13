/**
 * B6 e G6: avisos de operação em produção. Não impedem o sistema de subir; aparecem no /api/saude e no
 * topo do painel interno. Só nomes de variáveis, nunca valores.
 */
import { camposFaltando } from "./site";

export interface AvisoOperacao {
  codigo: "dados_empresa_incompletos" | "email_nao_configurado";
  detalhe: string[];
}

export function avisosOperacao(): AvisoOperacao[] {
  if (process.env.NODE_ENV !== "production") return [];
  const out: AvisoOperacao[] = [];
  const faltam = camposFaltando();
  if (faltam.length) out.push({ codigo: "dados_empresa_incompletos", detalhe: faltam });
  const email = ["SMTP_URL", "EMAIL_FROM"].filter((k) => !process.env[k]?.trim());
  if (email.length) out.push({ codigo: "email_nao_configurado", detalhe: email });
  return out;
}

export const TEXTO_AVISO: Record<AvisoOperacao["codigo"], string> = {
  dados_empresa_incompletos: "Dados da empresa incompletos no ambiente (o site esconde o que falta)",
  email_nao_configurado: "E-mail não configurado: ninguém confirma conta nem recebe aviso",
};
