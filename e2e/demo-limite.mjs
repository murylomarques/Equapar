// A.1 do prompt v4 (A3): 10 visitas seguidas à demonstração, do mesmo IP. Passa se criarem no máximo 3 contas.
// node e2e/demo-limite.mjs   (servidor em BASE_URL; padrão http://localhost:3001)
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright-core");
const { PrismaClient } = require("@prisma/client");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const db = new PrismaClient();
const antes = await db.conta.count({ where: { demo: true } });
const contratosAntes = await db.contrato.count({ where: { empresa: { conta: { demo: true } } } });
const b = await chromium.launch(process.env.NAVEGADOR ? { channel: process.env.NAVEGADOR } : {});
const t0 = Date.now();
for (let i = 0; i < 10; i++) {
  const p = await (await b.newContext()).newPage();
  await p.goto(`${BASE}/demonstracao`);
  await p.locator("form button[type=submit]").first().click();
  await p.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => {});
  await p.context().close();
}
const depois = await db.conta.count({ where: { demo: true } });
const contratosDepois = await db.contrato.count({ where: { empresa: { conta: { demo: true } } } });
console.log(`10 visitas em ${((Date.now() - t0) / 1000).toFixed(1)} s: contas demo ${antes} -> ${depois}; contratos de demonstração ${contratosAntes} -> ${contratosDepois}`);
if (depois - antes > 3) process.exitCode = 1;
await b.close(); await db.$disconnect();
