/**
 * A6 e D0: chaves de recurso, lidas do ambiente a cada requisição (valem pelo .env de quem sobe a imagem).
 * Trava 10: chave esconde, nunca apaga. Desligar devolve tudo como estava, com os mesmos dados.
 */
import { GUIAS } from "./guias";

/** MODO_PILOTO (padrão true): esconde assessoria, trocar de conta, Recuperado, histórico do órgão e guias fora do piloto. */
export function modoPiloto() {
  return (process.env.MODO_PILOTO ?? "true").trim().toLowerCase() !== "false";
}

/** D0: chave mestra da jornada (padrão false). */
export function jornadaLiberada() {
  return process.env.JORNADA_REGRA_CONFIRMADA === "true";
}

/**
 * GUIAS_PREVIA=true: mostra os guias com revisão jurídica pendente, com faixa de rascunho e sem indexação. Só para
 * conferir em máquina local ou mostrar ao advogado num ambiente fechado; nunca ligar no site público.
 */
export function previaGuias() {
  return process.env.GUIAS_PREVIA === "true";
}

export const GUIA_JORNADA = "jornada-40-horas-contratos-publicos";

/**
 * Guia no ar: só depende da revisão jurídica (decisão do dono, 27/11/2026). Com `revisao: "pendente"` (o advogado
 * ainda não aprovou) fica fora, salvo na prévia local; aprovado, fica no ar sempre, também no piloto e com o módulo da
 * jornada desligado: o guia informa, não vende o plano.
 */
export function guiaNoAr(slug: string) {
  const g = GUIAS.find((x) => x.slug === slug);
  return !!g && (g.revisao !== "pendente" || previaGuias());
}

/** Rotas escondidas pelo modo piloto: no site, 404; dentro do app, volta para Hoje. */
export const ROTAS_SITE_PILOTO = ["/assessorias"];
export const ROTAS_APP_PILOTO = ["/app/trocar-conta", "/app/recuperado"];

export function rotaEscondida(caminho: string): "404" | "hoje" | null {
  const em = (lista: string[]) => lista.some((r) => caminho === r || caminho.startsWith(`${r}/`));
  if (modoPiloto() && em(ROTAS_APP_PILOTO)) return "hoje";
  if (modoPiloto() && em(ROTAS_SITE_PILOTO)) return "404";
  const guia = /^\/guias\/([^/]+)\/?$/.exec(caminho);
  if (guia && !guiaNoAr(guia[1])) return "404";
  return null;
}

/** Login com Google: só com as duas chaves (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET); sem elas, nenhum botão aparece. */
export function googleAtivo() {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}
