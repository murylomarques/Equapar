// A.2 do prompt v4: mede a tabela da Carteira em 1280, 1440 e 1920 px (entra como dono).
import { BASE, navegador, entrarComoDono, fim } from "./bloqueadoras/util.mjs";
const b = await navegador();
try {
  for (const largura of [1280, 1440, 1920]) {
    const p = await entrarComoDono(await b.newContext({ viewport: { width: largura, height: 900 } }));
    await p.goto(`${BASE}/app/carteira`);
    await p.locator("table").first().waitFor();
    const r = await p.evaluate(() => {
      const t = document.querySelector("table");
      const out = [];
      for (let el = t; el && el !== document.body; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName}.${el.className} scroll=${el.scrollWidth} visível=${el.clientWidth}`);
      return { out, tabela: Math.round(t.getBoundingClientRect().width), pagina: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    console.log(`${largura}px: tabela ${r.tabela}px, rolagem lateral na página: ${r.pagina ? "SIM" : "não"}${r.out.length ? `; ${r.out.join(" | ")}` : ""}`);
    await p.context().close();
  }
} finally {
  await fim(b);
}
