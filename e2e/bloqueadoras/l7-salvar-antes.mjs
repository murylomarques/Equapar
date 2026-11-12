// L7: digitar no passo 3 e clicar em Continuar logo em seguida (antes dos 800 ms do salvamento automático)
// não pode perder a última edição.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./util.mjs";

const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true } } } });
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }); // só dado fictício
const ped = await db.pedido.create({
  data: { contratoId: c45.id, convencaoId: modelo.convencaoId, gatilho: modelo.gatilho, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito, planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora, passoAtual: 3 },
});
const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/3`);
  const todas = p.getByRole("button", { name: /Mostrar todas/ });
  if (await todas.count()) await todas.first().click();
  await p.getByLabel("Valor em R$ de Salário base").first().fill("1999,00");
  await p.locator(".rodape-assistente").getByRole("button", { name: "Continuar" }).click(); // sem esperar o salvamento
  await p.waitForURL(/passo\/4/, { timeout: 60000 }).catch(() => {});
  const x = await db.pedido.findUnique({ where: { id: ped.id } });
  const sal = x.planilhaAgora.tipos[0].linhas.find((l) => l.salarioBase)?.valor;
  conferir(Number(sal) === 1999, `a última edição foi salva antes de continuar (salário gravado: ${sal})`);
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
