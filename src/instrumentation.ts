/**
 * Roda a verificação de avisos de hora em hora enquanto o servidor estiver no ar.
 * Em produção com várias instâncias, desligue (AVISOS_AUTOMATICOS=false) e use o
 * agendador externo chamando /api/cron/avisos com CRON_SECRET.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AVISOS_AUTOMATICOS === "false") return;
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
