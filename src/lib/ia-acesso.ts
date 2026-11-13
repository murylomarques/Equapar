/**
 * E1. Chaves da leitura com IA (padrão false). Sem ANTHROPIC_API_KEY, nada aparece. Com a chave da API e a
 * chave do recurso desligada, só os e-mails de PAINEL_EMAILS veem, com o selo "em teste". Ligada, vale para todos.
 */
import { podeVerPainel } from "./metricas";

type Recurso = "PLANILHA" | "CONVENCAO";
const chave = (r: Recurso) => process.env[r === "PLANILHA" ? "IA_LEITURA_PLANILHA" : "IA_LEITURA_CONVENCAO"] === "true";

export function iaPara(r: Recurso, email: string) {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  return chave(r) || podeVerPainel(email);
}

/** O selo "em teste" aparece enquanto a chave do recurso estiver desligada (só PAINEL_EMAILS chegam a ver). */
export function iaEmTeste(r: Recurso) {
  return !chave(r);
}
