// Core Web Vitals de laboratório nas telas autenticadas e jornadas críticas (dados fictícios).
// Uso: SENHA_DONO=... node scripts/medir-web-vitals.mjs [BASE_URL]
// Condições: Edge/Chromium via Playwright, rede "4G lento" (150 ms RTT, 1,6 Mbps) e CPU 4× mais lenta (CDP),
// cache limpo a cada página. Mede LCP e CLS pelo PerformanceObserver do navegador e, como aproximação do INP,
// a maior duração de evento (Event Timing) em interações reais de cada tela. Laboratório ≠ dados reais de usuários.
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
const { PrismaClient } = createRequire(import.meta.url)("@prisma/client");
const db = new PrismaClient();

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const SENHA = process.env.SENHA_DONO;
if (!SENHA) throw new Error("Defina SENHA_DONO.");

const b = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`${BASE}/entrar`);
await p.fill("#email", "dono@exemplo.local");
await p.fill("#senha", SENHA);
await p.click('button[type="submit"]');
await p.waitForURL("**/app/**");

const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await p.addInitScript(() => {
  window.__wv = { lcp: 0, cls: 0, inp: 0 };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__wv.lcp = Math.max(window.__wv.lcp, e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__wv.cls += e.value))).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => e.interactionId && (window.__wv.inp = Math.max(window.__wv.inp, e.duration)))).observe({ type: "event", durationThreshold: 16, buffered: true });
});

// cada tela com uma interação típica (clique real, como o usuário faria)
const telas = [
  ["Hoje", "/app/hoje", async () => p.getByRole("link", { name: /Carteira/ }).first().hover()],
  ["Carteira", "/app/carteira", async () => p.locator("nav.filtros .filtro").nth(1).click()],
  ["Contrato (prazos)", null, async () => p.getByRole("link", { name: /Documentos/ }).first().click()],
  ["Pedidos", "/app/pedidos", async () => p.locator("nav.filtros .filtro").nth(1).click()],
  ["A receber", "/app/a-receber", async () => p.mouse.wheel(0, 400)],
  ["Avisos", "/app/avisos", async () => p.getByRole("link", { name: "Prazos" }).click()],
  ["Cobrança", "/app/configuracoes?aba=cobranca", async () => p.getByRole("radio").nth(2).check({ force: true })],
];
const c45 = await (await p.request.get(`${BASE}/app/carteira`)).text();
const id = /\/app\/contratos\/([a-z0-9]+)/.exec(c45)?.[1];
// pedido temporário em edição (cópia fictícia de um pedido de exemplo) para medir a digitação no editor da planilha
const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } } });
const temp = await db.pedido.create({ data: { contratoId: modelo.contratoId, convencaoId: modelo.convencaoId, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito, planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora, passoAtual: 3, estado: "EM_ANALISE" } });
telas.push(["Pedido passo 3 (digitação)", `/app/pedidos/${temp.id}/passo/3`, async () => {
  const campo = p.getByLabel(/^Valor em R\$ de Salário base/).first();
  await campo.click();
  await campo.press("End");
  await p.keyboard.type("1", { delay: 120 });
  await p.keyboard.press("Backspace");
}]);
const linhas = [];
for (const [nome, rota, interagir] of telas) {
  const url = rota ?? `/app/contratos/${id}?aba=prazos`;
  await cdp.send("Network.clearBrowserCache");
  const t0 = Date.now();
  await p.goto(BASE + url, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  try {
    await interagir();
  } catch {
    /* interação indisponível nesta tela: mede só o carregamento */
  }
  await p.waitForTimeout(800);
  const v = await p.evaluate(() => window.__wv);
  linhas.push({ nome, lcp: Math.round(v.lcp), cls: Number(v.cls.toFixed(3)), inp: Math.round(v.inp), carga: Date.now() - t0 });
}
console.log("| Tela | LCP | CLS | Maior interação (INP aprox.) |");
console.log("|---|---|---|---|");
for (const l of linhas) console.log(`| ${l.nome} | ${(l.lcp / 1000).toFixed(2)} s | ${l.cls} | ${l.inp} ms |`);
await db.pedido.delete({ where: { id: temp.id } }).catch(() => {});
await db.$disconnect();
await b.close();
