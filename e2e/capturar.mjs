// Captura de evidência para docs/pronto/RELATORIO.md.
// Uso: node e2e/capturar.mjs <pasta> <prefixo> <largura> <rota> [rota...]   (rotas /app entram como dono; "anon:" no início entra sem sessão)
import fs from "node:fs";
import path from "node:path";
import { BASE, navegador, entrarComoDono, fim } from "./bloqueadoras/util.mjs";
const [pasta, prefixo, largura, ...rotas] = process.argv.slice(2);
fs.mkdirSync(pasta, { recursive: true });
const b = await navegador();
try {
  const dono = await entrarComoDono(await b.newContext({ viewport: { width: Number(largura), height: 900 } }));
  const anon = await (await b.newContext({ viewport: { width: Number(largura), height: 900 } })).newPage();
  for (const [i, r0] of rotas.entries()) {
    const semSessao = r0.startsWith("anon:");
    const r = semSessao ? r0.slice(5) : r0;
    const p = semSessao ? anon : dono;
    await p.goto(`${BASE}${r}`);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(400);
    const arq = path.join(pasta, `${prefixo}-${i + 1}-${largura}.png`);
    await p.screenshot({ path: arq, fullPage: true });
    console.log(arq);
  }
} finally {
  await fim(b);
}
