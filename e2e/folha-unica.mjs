// Verificação final (seção 9): uma captura de cada tela principal em 390 px e em 1.440 px, numa folha única.
// Uso: node e2e/folha-unica.mjs <pedidoId> <saida.png>   (servidor em BASE_URL, entra como dono)
import fs from "node:fs";
import path from "node:path";
import { BASE, navegador, entrarComoDono, fim } from "./bloqueadoras/util.mjs";
const [pedidoId, saida = "docs/pronto/capturas/folha-unica.png"] = process.argv.slice(2);
const TELAS = [
  ["Landing", "anon:/"], ["Raio-X", "anon:/raio-x"], ["Preços", "anon:/precos"], ["Demonstração", "anon:/demonstracao"],
  ["Hoje", "/app/hoje"], ["Carteira", "/app/carteira"], ["Pedidos", "/app/pedidos"], ["Pedido · passo 3", `/app/pedidos/${pedidoId}/passo/3`],
  ["Memória", `/app/pedidos/${pedidoId}/memoria`], ["A receber", "/app/a-receber"], ["Convenções", "/app/convencoes"], ["Painel interno", "/app/interno"],
];
const b = await navegador();
const imgs = [];
try {
  for (const largura of [390, 1440]) {
    const altura = largura === 390 ? 844 : 900;
    const dono = await entrarComoDono(await b.newContext({ viewport: { width: largura, height: altura } }));
    const anon = await (await b.newContext({ viewport: { width: largura, height: altura } })).newPage();
    for (const [nome, r0] of TELAS) {
      const p = r0.startsWith("anon:") ? anon : dono;
      await p.goto(`${BASE}${r0.replace("anon:", "")}`);
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(300);
      imgs.push({ nome, largura, b64: (await p.screenshot()).toString("base64") });
    }
  }
  const celula = (i) => `<figure><img src="data:image/png;base64,${i.b64}" style="width:${i.largura === 390 ? 195 : 480}px"><figcaption>${i.nome} · ${i.largura} px</figcaption></figure>`;
  const html = `<html><body style="font:12px sans-serif;background:#eee;margin:16px"><h1 style="font-size:16px">Equapar · telas principais (390 px e 1.440 px)</h1>
  <h2 style="font-size:14px">390 px</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${imgs.filter((i) => i.largura === 390).map(celula).join("")}</div>
  <h2 style="font-size:14px">1.440 px</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${imgs.filter((i) => i.largura === 1440).map(celula).join("")}</div></body></html>`;
  const folha = await (await b.newContext({ viewport: { width: 2050, height: 1000 } })).newPage();
  await folha.setContent(html);
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  await folha.screenshot({ path: saida, fullPage: true });
  console.log(saida);
} finally {
  await fim(b);
}
