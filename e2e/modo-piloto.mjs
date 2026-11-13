// A6: liga e desliga MODO_PILOTO. Rode duas vezes, com o servidor subido com MODO_PILOTO=true e depois =false:
//   ESPERADO=ligado node e2e/modo-piloto.mjs   |   ESPERADO=desligado node e2e/modo-piloto.mjs
// Confere as rotas (404 no site, Hoje no app) e que os dados são os mesmos nos dois estados (a chave só esconde).
import fs from "node:fs";
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";
const ligado = process.env.ESPERADO !== "desligado";
const contagem = { contas: await db.conta.count(), pedidos: await db.pedido.count(), contratos: await db.contrato.count(), documentos: await db.documento.count() };
const arq = "e2e/.modo-piloto-dados.json";
const b = await navegador();
try {
  const anon = await (await b.newContext()).newPage();
  for (const r of ["/assessorias", "/guias/reforma-tributaria-contratos-publicos-reequilibrio"]) {
    const s = (await anon.request.get(`${BASE}${r}`)).status();
    conferir(ligado ? s === 404 : s === 200, `${r}: ${s} (${ligado ? "esperado 404" : "esperado 200"})`);
  }
  for (const r of ["/guias/repactuacao-passo-a-passo-lei-14133", "/guias/prorrogacao-sem-perder-a-repactuacao", "/guias/convencao-coletiva-limpeza-data-base"])
    conferir((await anon.request.get(`${BASE}${r}`)).status() === 200, `${r} sempre no ar`);
  const p = await entrarComoDono(await b.newContext());
  for (const r of ["/app/recuperado", "/app/trocar-conta"]) {
    await p.goto(`${BASE}${r}`);
    conferir(ligado ? /\/app\/hoje/.test(p.url()) : p.url().endsWith(r), `${r} → ${new URL(p.url()).pathname}`);
  }
  await p.goto(`${BASE}/app/a-receber`);
  await p.locator("main h1").first().waitFor();
  conferir(((await p.getByRole("link", { name: "Recuperado com a Equapar" }).count()) === 0) === ligado, `link Recuperado em A receber ${ligado ? "escondido" : "visível"}`);
  // trava 10: os dados são os mesmos nos dois estados
  if (fs.existsSync(arq)) {
    const antes = JSON.parse(fs.readFileSync(arq, "utf8"));
    conferir(JSON.stringify(antes) === JSON.stringify(contagem), `mesmos dados nos dois estados: ${JSON.stringify(contagem)}`);
    fs.unlinkSync(arq);
  } else fs.writeFileSync(arq, JSON.stringify(contagem));
} finally {
  await fim(b);
}
