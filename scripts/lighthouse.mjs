// A5: Lighthouse no celular simulado, 3 rodadas, mediana. Uso: node scripts/lighthouse.mjs <url> [rodadas]
// Navegador: CHROME_PATH (ex.: o Edge instalado). Não afrouxa nada: mede o build como está.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const url = process.argv[2] ?? "http://localhost:3100/";
const n = Number(process.argv[3] ?? 3);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-"));
const rodadas = [];
for (let i = 0; i < n; i++) {
  const saida = path.join(tmp, `r${i}.json`);
  execFileSync("npx", ["-y", "lighthouse@12.8.2", url, "--only-categories=performance", "--form-factor=mobile", "--output=json", `--output-path=${saida}`, "--chrome-flags=--headless=new", "--quiet"], { stdio: "ignore", shell: true });
  const r = JSON.parse(fs.readFileSync(saida, "utf8"));
  const a = r.audits;
  rodadas.push({ nota: Math.round(r.categories.performance.score * 100), lcp: a["largest-contentful-paint"].numericValue, fcp: a["first-contentful-paint"].numericValue, tbt: a["total-blocking-time"].numericValue, cls: a["cumulative-layout-shift"].numericValue });
  console.log(`rodada ${i + 1}: nota ${rodadas.at(-1).nota} · LCP ${(rodadas.at(-1).lcp / 1000).toFixed(2)} s · FCP ${(rodadas.at(-1).fcp / 1000).toFixed(2)} s · TBT ${Math.round(rodadas.at(-1).tbt)} ms · CLS ${rodadas.at(-1).cls.toFixed(3)}`);
}
const med = (k) => [...rodadas.map((r) => r[k])].sort((a, b) => a - b)[Math.floor(rodadas.length / 2)];
console.log(`MEDIANA: LCP ${(med("lcp") / 1000).toFixed(2)} s · FCP ${(med("fcp") / 1000).toFixed(2)} s · TBT ${Math.round(med("tbt"))} ms · CLS ${med("cls").toFixed(3)} · nota ${med("nota")}`);
