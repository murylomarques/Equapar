/**
 * A6 e D0: chaves de recurso, lidas do ambiente a cada requisição (valem pelo .env de quem sobe a imagem).
 * Trava 10: chave esconde, nunca apaga. Desligar devolve tudo como estava, com os mesmos dados.
 */

/** MODO_PILOTO (padrão true): esconde assessoria, trocar de conta, Recuperado, histórico do órgão e guias fora do piloto. */
export function modoPiloto() {
  return (process.env.MODO_PILOTO ?? "true").trim().toLowerCase() !== "false";
}

/** D0: chave mestra da jornada (padrão false). */
export function jornadaLiberada() {
  return process.env.JORNADA_REGRA_CONFIRMADA === "true";
}

/** Guias que ficam no ar sempre, também no piloto. */
export const GUIAS_NO_AR = ["repactuacao-passo-a-passo-lei-14133", "prorrogacao-sem-perder-a-repactuacao", "convencao-coletiva-limpeza-data-base"] as const;
export const GUIA_JORNADA = "jornada-40-horas-contratos-publicos";

export function guiaNoAr(slug: string) {
  if ((GUIAS_NO_AR as readonly string[]).includes(slug)) return true;
  if (slug === GUIA_JORNADA) return jornadaLiberada(); // volta junto com a chave da fase D
  return !modoPiloto();
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
