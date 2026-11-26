// G5: teste rápido contra APP_URL que SÓ LÊ. Não cria conta, não envia e-mail, não usa dado real.
// A demonstração é aberta uma vez (cria uma cópia fictícia de 4 horas, como qualquer visitante).
//   APP_URL=https://equapar.com.br npm run e2e:producao
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright-core");

const BASE = (process.env.APP_URL ?? "http://localhost").replace(/\/$/, "");
let falhas = 0;
const conferir = (ok, msg) => {
  console.log(`${ok ? "OK   " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
};

const home = await fetch(`${BASE}/`, { redirect: "manual" });
conferir(home.status === 200, `home responde 200 (veio ${home.status})`);
const cab = (n) => home.headers.get(n) ?? "";
conferir(cab("content-security-policy").includes("default-src"), "home com CSP");
conferir(cab("strict-transport-security").includes("max-age"), "home com HSTS");
conferir(cab("x-content-type-options") === "nosniff", "home com X-Content-Type-Options: nosniff");

const saude = await fetch(`${BASE}/api/saude`);
const s = await saude.json().catch(() => ({}));
conferir(saude.status === 200 && s.ok === true, `/api/saude OK (banco ${s.banco}, fila ${s.fila}${s.avisos?.length ? `, avisos: ${s.avisos.map((a) => a.codigo).join(", ")}` : ""})`);

for (const r of ["/raio-x", "/precos", "/termos", "/privacidade", "/metodo/levantamento-limpeza", "/entrar"]) {
  const x = await fetch(`${BASE}${r}`, { redirect: "manual" });
  conferir(x.status === 200, `${r} abre (${x.status})`);
}

const b = await chromium.launch(process.env.NAVEGADOR ? { channel: process.env.NAVEGADOR } : {});
try {
  const p = await (await b.newContext()).newPage();
  await p.goto(`${BASE}/demonstracao`);
  await p.locator("form button[type=submit]").first().click();
  await p.waitForURL(/\/app\/hoje/, { timeout: 60000 }).catch(() => {});
  conferir(/\/app\/hoje/.test(p.url()), "a demonstração abre (uma vez)");
} finally {
  await b.close();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTudo certo.");
process.exitCode = falhas ? 1 : 0;
