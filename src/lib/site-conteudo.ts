/**
 * Textos do site usados em mais de uma página (início e "Software de repactuação"), para as duas dizerem o mesmo.
 * Só o que o produto faz hoje.
 */
import { canaisDeAviso } from "./site";

/** Comparação: critério, planilha e memória, consultoria por pedido, Equapar. */
export const COMPARACAO = [
  ["Avisa antes da prorrogação", "Se alguém lembrar", "Se contratada para isso", "Sempre, por contrato"],
  ["Mostra de onde saiu cada número", "Depende de quem fez", "Sim", "Sim, linha a linha"],
  ["Acompanha até receber", "Depende da equipe", "Depende do escopo", "Sim"],
  ["Como se paga", "Horas da equipe", "Por pedido", "Por mês, por posto"],
] as const;

/** Como funciona: as cinco etapas que o produto cobre hoje. */
export function etapas() {
  return [
    ["Contrato", "Digite o CNPJ: os contratos publicados no PNCP entram sozinhos. Você confirma a convenção coletiva de cada um."],
    ["Repactuação", `${canaisDeAviso()} aos 60, 30 e 7 dias do prazo, com o que fazer em cada caso: pedir, ressalvar ou esperar a convenção.`],
    ["Memória e documentos", "Envie a planilha de custos da proposta. A Equapar refaz a conta, mostra a origem de cada número e gera ofício, planilha e memória de cálculo editáveis."],
    ["Protocolo", "Você confere e protocola pelo canal do contrato. A Equapar guarda o número e conta o prazo de resposta do órgão."],
    ["Recebimento", "Apostilamento, nota fiscal da diferença e recebimento. Nada sai da lista antes de o dinheiro entrar."],
  ] as const;
}
