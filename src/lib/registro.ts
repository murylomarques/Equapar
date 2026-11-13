/**
 * Fase 1 (4.1.5). Logs estruturados (uma linha JSON por evento, com o id da requisição) e alerta de erro.
 * O alerta vai para ERROS_WEBHOOK_URL (Sentry via relay, Slack, PagerDuty, Better Stack…: qualquer
 * endpoint que receba JSON). Vazio = SIMULAÇÃO: só o log. Ligar é decisão do dono (trava 5).
 * Nunca registrar dado pessoal: só ids, códigos, mensagem e pilha.
 */
type Nivel = "info" | "aviso" | "erro";

export function registrar(nivel: Nivel, evento: string, dados: Record<string, unknown> = {}, requisicao?: string | null) {
  const linha = JSON.stringify({ quando: new Date().toISOString(), nivel, evento, ...(requisicao ? { requisicao } : {}), ...dados });
  if (nivel === "erro") console.error(linha);
  else console.log(linha);
}

export async function reportarErro(e: unknown, ctx: { codigo?: string; requisicao?: string | null; onde?: string } = {}): Promise<"simulado" | "enviado" | "falhou"> {
  const err = e instanceof Error ? e : new Error(String(e));
  registrar("erro", "erro", { codigo: ctx.codigo, onde: ctx.onde, mensagem: err.message, pilha: err.stack?.split("\n").slice(0, 8).join("\n") }, ctx.requisicao);
  const url = process.env.ERROS_WEBHOOK_URL;
  if (!url) return "simulado";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app: "equapar", ambiente: process.env.NODE_ENV, mensagem: err.message, pilha: err.stack, codigo: ctx.codigo, requisicao: ctx.requisicao, onde: ctx.onde, quando: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
    return "enviado";
  } catch {
    return "falhou";
  }
}
