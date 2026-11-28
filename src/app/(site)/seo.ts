import type { Metadata } from "next";
import { contatoSite, dadosEmpresa, dominioPublico } from "@/lib/site";

/** Endereço público do site: APP_URL; sem ele, o domínio do e-mail de contato (nunca fixo no código). */
export function urlSite() {
  return (process.env.APP_URL?.trim() || `https://${dominioPublico()}`).replace(/\/$/, "");
}

/** Título, descrição, endereço canônico e Open Graph de uma página pública (o canônico usa o metadataBase do layout raiz). */
export function metaPagina({ titulo, descricao, caminho, indexar = true, tipo = "website" }: { titulo: string; descricao?: string; caminho: string; indexar?: boolean; tipo?: "website" | "article" }): Metadata {
  return {
    title: titulo,
    ...(descricao ? { description: descricao } : {}),
    alternates: { canonical: caminho },
    openGraph: { title: titulo, ...(descricao ? { description: descricao } : {}), url: caminho, siteName: "Equapar", locale: "pt_BR", type: tipo },
    ...(indexar ? {} : { robots: { index: false, follow: true } }),
  };
}

/** JSON-LD só com dados reais: nome e endereço do site; CNPJ, razão social e endereço só quando o ambiente os traz. */
export function jsonLdEquapar() {
  const url = urlSite();
  const e = dadosEmpresa();
  const emailConfigurado = !!process.env.SITE_EMAIL_CONTATO?.trim();
  const organizacao = {
    "@type": "Organization",
    "@id": `${url}/#organizacao`,
    name: "Equapar",
    url,
    logo: `${url}/equapar-logo.svg`,
    ...(emailConfigurado ? { email: contatoSite().email } : {}),
    ...(e.cnpj ? { legalName: e.razaoSocial, taxID: e.cnpj } : {}),
    ...(e.cnpj && e.endereco ? { address: e.endereco } : {}),
  };
  const aplicacao = {
    "@type": "SoftwareApplication",
    name: "Equapar",
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: "Controle de repactuação de contratos públicos com mão de obra: prazos, memória de cálculo e documentos, do pedido ao recebimento.",
    publisher: { "@id": `${url}/#organizacao` },
  };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [organizacao, aplicacao] }).replace(/</g, "\\u003c");
}

/**
 * JSON-LD de um guia: Article (com data e autoria da Equapar), BreadcrumbList e, se houver, FAQPage com as mesmas
 * perguntas e respostas que aparecem na página (o Google exige que o FAQ seja visível).
 */
export function jsonLdGuia(g: { slug: string; titulo: string; descricao: string; atualizadoEm?: string; faq?: { pergunta: string; resposta: string }[] }) {
  const url = urlSite();
  const pagina = `${url}/guias/${g.slug}`;
  const artigo = {
    "@type": "Article",
    "@id": `${pagina}#artigo`,
    headline: g.titulo,
    description: g.descricao,
    inLanguage: "pt-BR",
    mainEntityOfPage: pagina,
    ...(g.atualizadoEm ? { dateModified: g.atualizadoEm } : {}),
    author: { "@id": `${url}/#organizacao` },
    publisher: { "@id": `${url}/#organizacao` },
  };
  const trilha = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${url}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${url}/guias` },
      { "@type": "ListItem", position: 3, name: g.titulo, item: pagina },
    ],
  };
  const faq = g.faq?.length
    ? [{ "@type": "FAQPage", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })) }]
    : [];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [artigo, trilha, ...faq] }).replace(/</g, "\\u003c");
}

/** JSON-LD FAQPage de uma página comum (perguntas visíveis na própria página). */
export function jsonLdPerguntas(perguntas: readonly (readonly [string, string])[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map(([p, r]) => ({ "@type": "Question", name: p, acceptedAnswer: { "@type": "Answer", text: r } })),
  }).replace(/</g, "\\u003c");
}
