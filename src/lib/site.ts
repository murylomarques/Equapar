/**
 * B1. Dados institucionais do site: SÓ pelo ambiente (variáveis SITE_*). Nenhum valor real fica no código,
 * nos testes ou no relatório (trava 11). Cada campo vazio tem um comportamento definido (ver .env.example).
 */
import { cnpjValido, formatarCnpj, normalizarCnpj } from "./cnpj";

const env = (k: string) => process.env[k]?.trim() || "";

/** Fato público da faixa de fatos (Produto e experiência, seção 3). Método em /metodo/levantamento-limpeza. */
export const SITE = {
  levantamentoLimpeza: { empresas: "1.447", data: "10/11/2026" },
};

/** As variáveis SITE_* que o site usa (SITE_AGENDA_URL é opcional e não entra na lista do que falta). */
export const VARIAVEIS_SITE = ["SITE_EMAIL_CONTATO", "SITE_WHATSAPP", "SITE_FUNDADOR_NOME", "SITE_FUNDADOR_FOTO", "SITE_RAZAO_SOCIAL", "SITE_CNPJ", "SITE_ENDERECO", "SITE_CIDADE"] as const;

/** Dados da empresa como devem aparecer, já com o comportamento de cada campo vazio. */
export function dadosEmpresa() {
  const cnpjBruto = env("SITE_CNPJ");
  const cnpj = cnpjBruto && cnpjValido(cnpjBruto) ? formatarCnpj(normalizarCnpj(cnpjBruto)) : null;
  const cidade = env("SITE_CIDADE") || null;
  return {
    /** sem CNPJ, a empresa aparece como "em constituição" (B5) */
    razaoSocial: cnpj ? env("SITE_RAZAO_SOCIAL") || "Equapar" : env("SITE_RAZAO_SOCIAL") || "Equapar (empresa em constituição)",
    emConstituicao: !cnpj,
    cnpj,
    cnpjInvalido: !!cnpjBruto && !cnpj,
    endereco: env("SITE_ENDERECO") || null,
    cidade,
    /** endereço completo; sem ele, só a cidade */
    local: env("SITE_ENDERECO") || cidade,
    fundadorNome: env("SITE_FUNDADOR_NOME") || null,
    fundadorFoto: env("SITE_FUNDADOR_FOTO") || null,
  };
}

/** B6: quais SITE_* estão vazias (nomes, nunca valores). CNPJ inválido conta como faltando. */
export function camposFaltando(): string[] {
  const d = dadosEmpresa();
  return VARIAVEIS_SITE.filter((k) => (k === "SITE_CNPJ" ? !d.cnpj : !env(k)));
}

/** Telefone do WhatsApp para exibir: "+55 (11) 90000-0000" (dígitos com DDI 55). */
export function telefoneFormatado(digitos: string) {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digitos}`;
}

/** Conta de demonstração (papel Leitura, dados fictícios), criada pelo seed. */
export const EMAIL_DEMO = "demonstracao@equapar.local";
/** 5.2: conta modelo da demonstração de assessoria (vários clientes fictícios), criada pelo seed. Ninguém entra nela. */
export const EMAIL_DEMO_ASSESSORIA = "demonstracao-assessoria@equapar.local";

/** B4: canais de contato a partir do ambiente (valores reais nunca ficam no código). */
export const MENSAGEM_WHATSAPP = "Olá! Vim pelo site da Equapar e quero saber mais.";
export function contatoSite() {
  const email = process.env.SITE_EMAIL_CONTATO?.trim() || "contato@equapar.com";
  const whatsapp = (process.env.SITE_WHATSAPP ?? "").replace(/\D/g, "");
  return {
    email,
    emailLink: `mailto:${email}`,
    whatsapp: whatsapp || null,
    whatsappLink: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(MENSAGEM_WHATSAPP)}` : null,
    agendaUrl: process.env.SITE_AGENDA_URL?.trim() || null,
  };
}

/** A4: o site só promete WhatsApp quando a integração existe (WHATSAPP_TOKEN). */
export function canaisDeAviso() {
  return process.env.WHATSAPP_TOKEN ? "Avisos por e-mail e WhatsApp" : "Avisos por e-mail";
}

/**
 * B5: como termos e privacidade identificam a empresa. Sem SITE_CNPJ: "Equapar, empresa em constituição",
 * com o fundador como responsável, o e-mail como canal do titular e a cidade como local. Com o CNPJ preenchido,
 * razão social, CNPJ e endereço, sem nova programação.
 */
export function identificacaoEmpresa() {
  const e = dadosEmpresa();
  const c = contatoSite();
  if (e.cnpj)
    return {
      texto: [e.razaoSocial, `CNPJ ${e.cnpj}`, e.local].filter(Boolean).join(", "),
      responsavel: e.fundadorNome,
      canal: c.email,
      local: e.local,
    };
  return {
    texto: ["Equapar, empresa em constituição", e.fundadorNome && `sob a responsabilidade de ${e.fundadorNome}`, e.cidade].filter(Boolean).join(", "),
    responsavel: e.fundadorNome,
    canal: c.email,
    local: e.cidade,
  };
}

/** B2: domínio público (equapar.com) derivado do ambiente, nunca fixo no código. */
export function dominioPublico() {
  const email = contatoSite().email;
  return email.includes("@") ? email.split("@")[1] : "equapar.com";
}

/** Remetente dos e-mails: EMAIL_FROM; sem ele, "Equapar Avisos <avisos@<domínio do contato>>". */
export function remetentePadrao() {
  return process.env.EMAIL_FROM?.trim() || `Equapar Avisos <avisos@${dominioPublico()}>`;
}

/** Identificação enviada ao PNCP (o firewall derruba conexões sem User-Agent): site e contato público. */
export function agentePncp() {
  const site = process.env.APP_URL?.trim() || `https://${dominioPublico()}`;
  return `Mozilla/5.0 (compatible; EquaparBot/1.0; +${site}; ${contatoSite().email})`;
}
