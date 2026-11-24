// A6: liga e desliga MODO_PILOTO. Rode duas vezes, com o servidor subido com MODO_PILOTO=true e depois =false:
//   ESPERADO=ligado node e2e/modo-piloto.mjs   |   ESPERADO=desligado node e2e/modo-piloto.mjs
// Confere as rotas (404 no site, Hoje no app) e que percorrer o modo não cria nem apaga dados (a chave só esconde).
// Autossuficiente: compara a contagem antes e depois da própria execução (antes dependia de um arquivo da execução anterior).
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";
const ligado = process.env.ESPERADO !== "desligado";
const contar = async () => ({ contas: await db.conta.count({ where: { demo: false } }), pedidos: await db.pedido.count(), contratos: await db.contrato.count({ where: { empresa: { conta: { demo: false } } } }), documentos: await db.documento.count() });
const contagem = await contar();
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
  // trava 10: as rotas do modo só escondem; nenhum dado é criado ou apagado ao percorrê-las
  const depois = await contar();
  conferir(JSON.stringify(depois) === JSON.stringify(contagem), `mesmos dados antes e depois (${ligado ? "ligado" : "desligado"}): ${JSON.stringify(depois)}`);
} finally {
  await fim(b);
}
