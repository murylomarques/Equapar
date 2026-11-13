/**
 * Fase 1 (4.1.1): os avisos de hora em hora vêm do worker (`npm run worker`), pela fila.
 * Só numa instalação de um processo, sem worker, ligue AVISOS_AUTOMATICOS=true para o servidor rodá-los.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AVISOS_AUTOMATICOS !== "true") return;
  const g = globalThis as unknown as { __avisos?: NodeJS.Timeout };
  if (g.__avisos) return;
  const { rodarAvisos } = await import("./lib/avisos");
  const rodar = () =>
    rodarAvisos()
      .then((r) => console.info("[avisos]", r))
      .catch((e) => console.error("[avisos] falhou", e));
  setTimeout(rodar, 30_000);
  g.__avisos = setInterval(rodar, 60 * 60 * 1000);
}
