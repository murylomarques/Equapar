/**
 * Dados institucionais que aparecem no site. PREENCHA antes de publicar:
 * os campos marcados com [PREENCHER] ainda não existem nos documentos (empresa a constituir).
 */
export const SITE = {
  razaoSocial: "[PREENCHER] Equapar Tecnologia Ltda.",
  cnpj: "[PREENCHER] 00.000.000/0000-00",
  endereco: "[PREENCHER] Endereço da sede",
  email: "contato@equapar.com.br",
  whatsapp: "[PREENCHER] (00) 00000-0000",
  fundador: {
    nome: "[PREENCHER] Nome do fundador",
    /** Caminho de uma foto real em /public (ex.: "/fundador.jpg"). Vazio mostra o espaço reservado. */
    foto: "",
  },
  /** Fato público da faixa de fatos (Produto e experiência, seção 3). Atualize com novo levantamento. */
  levantamentoLimpeza: { empresas: "1.447", data: "10/11/2026" },
};

/**
 * 5.2: campo ainda com [PREENCHER] não aparece em produção (devolve null; a tela esconde o campo).
 * Em desenvolvimento aparece, para lembrar de preencher.
 */
export function dadoSite(v: string): string | null {
  if (!v.includes("[PREENCHER]")) return v;
  return process.env.NODE_ENV === "production" ? null : v;
}

/** Nomes dos campos que ainda faltam (para o aviso no build). */
export function camposFaltando(): string[] {
  const f: string[] = [];
  const ver = (nome: string, v: string) => v.includes("[PREENCHER]") && f.push(nome);
  ver("razaoSocial", SITE.razaoSocial);
  ver("cnpj", SITE.cnpj);
  ver("endereco", SITE.endereco);
  ver("whatsapp", SITE.whatsapp);
  ver("fundador.nome", SITE.fundador.nome);
  return f;
}

/** Conta de demonstração (papel Leitura, dados fictícios), criada pelo seed. */
export const EMAIL_DEMO = "demonstracao@equapar.local";
