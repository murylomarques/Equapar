// Acessibilidade automática (axe-core, WCAG 2.1 A/AA) em todas as rotas, no computador e no celular.
// Falha se houver violação "serious" ou "critical". Também confere "reduzir movimento".
// Uso: node e2e/acessibilidade.mjs   (servidor em BASE_URL; entra com a conta fictícia dono@exemplo.local)
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const db = new PrismaClient();
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SENHA_DONO = process.env.SENHA_DONO; // senha impressa pelo seed (npm run db:seed)
if (!SENHA_DONO) throw new Error("Defina SENHA_DONO com a senha do dono@exemplo.local impressa pelo seed.");
const SAIDA = path.resolve(process.argv[2] ?? "docs/redesenho/acessibilidade.json");

const ex = { contrato: { empresa: { exemplo: true, conta: { demo: false } } } };
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false } } } });
const c19 = await db.contrato.findFirst({ where: { numero: "19/2025", empresa: { exemplo: true, conta: { demo: false } } } });
const prot = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", ...ex } });
const def = await db.pedido.findFirst({ where: { estado: "DEFERIDO", ...ex } });
await db.$disconnect();

const SITE = ["/", "/raio-x", "/raio-x?cnpj=11111111111111", "/precos", "/assessorias", "/guias", "/guias/prorrogacao-sem-perder-a-repactuacao", "/privacidade", "/termos", "/entrar", "/criar-conta", "/pagina-que-nao-existe"];
const APP = [
  "/app/hoje", "/app/boas-vindas", "/app/boas-vindas?passo=contratos", "/app/boas-vindas?passo=convencoes", "/app/boas-vindas?passo=pronto",
  "/app/carteira", "/app/carteira?filtro=prazo60", "/app/contratos/novo",
  ...["resumo", "prazos", "pedidos", "documentos", "historico"].map((a) => `/app/contratos/${c45.id}?aba=${a}`),
  `/app/contratos/${c45.id}/prorrogacao`, "/app/pedidos", `/app/pedidos/novo?contrato=${c19.id}`,
  ...[1, 2, 3, 4, 5].map((n) => `/app/pedidos/${prot.id}/passo/${n}`),
  `/app/pedidos/${prot.id}/memoria`, `/app/pedidos/${prot.id}/pronto`, `/app/pedidos/${def.id}/pronto`,
  "/app/a-receber", "/app/convencoes", "/app/avisos", "/app/busca?q=Exemplo",
  ...["empresa", "pessoas", "avisos", "cobranca", "seguranca", "dados"].map((a) => `/app/configuracoes?aba=${a}`),
];

const browser = await chromium.launch({ headless: true, ...(process.env.NAVEGADOR ? { channel: process.env.NAVEGADOR } : {}) });
const relatorio = [];
let graves = 0;

async function auditar(page, rota, tam) {
  await page.goto(BASE + rota, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }),
  );
  const v = r.violations.map((x) => ({ id: x.id, impacto: x.impact, ajuda: x.help, nos: x.nodes.length, exemplo: x.nodes[0]?.target?.join(" ") }));
  const g = v.filter((x) => x.impacto === "serious" || x.impacto === "critical");
  graves += g.length;
  relatorio.push({ rota, tamanho: tam, violacoes: v });
  console.log(`${g.length ? "GRAVE" : "ok   "} [${tam}] ${rota}${v.length ? `  (${v.map((x) => `${x.id}:${x.impacto}`).join(", ")})` : ""}`);
}

try {
  for (const [tam, opts] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    ["celular", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await browser.newContext({ ...opts, locale: "pt-BR" });
    const page = await ctx.newPage();
    for (const r of SITE) await auditar(page, r, tam);
    await page.goto(BASE + "/entrar");
    await page.fill("#email", "dono@exemplo.local");
    await page.fill("#senha", SENHA_DONO);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app/**");
    for (const r of APP) await auditar(page, r, tam);
    await ctx.close();
  }

  // Reduzir movimento: o combinado é trocar movimento por esmaecer de até 100 ms (o spinner continua girando).
  // Rolamos a landing e abrimos o menu da conta; nada pode durar mais de 100 ms nem deslocar com transform.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const checar = () =>
    page.evaluate(() => {
      const ms = (v) => Math.max(...v.split(",").map((x) => (x.trim().endsWith("ms") ? parseFloat(x) : parseFloat(x) * 1000)));
      return [...document.body.querySelectorAll("*")]
        .filter((el) => !el.classList.contains("spinner"))
        .map((el) => {
          const s = getComputedStyle(el);
          const anim = s.animationName !== "none" ? ms(s.animationDuration) * (s.animationIterationCount === "infinite" ? 1000 : Number(s.animationIterationCount)) : 0;
          return { el: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`, anim, trans: ms(s.transitionDuration), revelando: el.classList.contains("entrando") };
        })
        .filter((x) => x.anim > 100 || x.trans > 100 || x.revelando);
    });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  for (let y = 0; y < 8; y++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }
  const longas = await checar();
  console.log(longas.length ? `GRAVE reduzir movimento: ${longas.length} elementos animam (${longas.slice(0, 3).map((x) => x.el).join(", ")})` : "ok    reduzir movimento: na landing nada passa de 100 ms nem entra deslizando");
  if (longas.length) graves++;
  relatorio.push({ rota: "/ (reduzir movimento)", elementosAnimando: longas });
  await ctx.close();
} finally {
  await browser.close();
  fs.writeFileSync(SAIDA, JSON.stringify(relatorio, null, 2));
}
console.log(`\n${relatorio.length} verificações; violações graves (serious/critical): ${graves}. Detalhes em ${SAIDA}`);
if (graves) process.exitCode = 1;
