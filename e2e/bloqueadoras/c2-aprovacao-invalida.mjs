// C2: mudar a base do cálculo depois da aprovação tem de desfazer a aprovação.
// Cria um pedido CALCULO_VALIDADO aprovado (cópia do pedido protocolado do exemplo, fictício),
// troca a data-base no passo 1 e a data "contar até" no passo 3, e lê o pedido no banco.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./util.mjs";

const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true, conta: { demo: false } } } } });
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false } } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }); // só dado fictício
const aprovado = () => ({ estado: "CALCULO_VALIDADO", memoriaAprovadaEm: new Date(), memoriaAprovadaPor: "Marcos (exemplo)", geradoEm: new Date() });
const ped = await db.pedido.create({
  data: {
    contratoId: c45.id, convencaoId: modelo.convencaoId, gatilho: modelo.gatilho, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito,
    dataReferencia: new Date(Date.UTC(2026, 10, 12)), planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora,
    checklist: { convencao_nova: "ANEXADO", planilha_atual: "ANEXADO" }, passoAtual: 5, ...aprovado(),
  },
});

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());

  // 1) data-base: 01/01/2026 -> 01/06/2026
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/1`);
  await p.getByLabel("Data-base").fill("01/06/2026");
  await p.locator(".rodape-assistente").getByRole("button", { name: "Continuar" }).click();
  await p.waitForURL(/passo\/2/);
  let x = await db.pedido.findUnique({ where: { id: ped.id } });
  conferir(x.dataBase.toISOString().startsWith("2026-06-01"), "data-base gravada como 01/06/2026");
  conferir(x.memoriaAprovadaEm === null, "mudar a data-base desfaz a aprovação da memória");
  conferir(x.estado === "EM_ANALISE", `pedido volta para EM_ANALISE (está ${x.estado})`);

  // 2) data "contar até" no passo 3, com o pedido aprovado de novo
  await db.pedido.update({ where: { id: ped.id }, data: { ...aprovado(), dataBase: modelo.dataBase } });
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/3`);
  await p.getByLabel("Contar a diferença até").fill("30/09/2026");
  await p.locator(".rodape-assistente").getByRole("button", { name: "Continuar" }).click();
  await p.waitForURL(/passo\/4/);
  x = await db.pedido.findUnique({ where: { id: ped.id } });
  conferir(x.dataReferencia.toISOString().startsWith("2026-09-30"), "data de referência gravada como 30/09/2026");
  conferir(x.memoriaAprovadaEm === null && x.estado === "EM_ANALISE", "mudar a data de referência desfaz a aprovação");

  // 3) histórico registra o motivo
  const h = await db.historico.findMany({ where: { pedidoId: ped.id } });
  conferir(h.some((e) => /aprovação/i.test(`${e.acao} ${e.detalhe ?? ""}`)), "histórico registra a aprovação desfeita");
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
