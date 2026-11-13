// C3: as regras do passo 3 não podem ser puladas indo direto ao passo 5,
// e a diferença gravada (usada nas listas) tem de ser a mesma dos documentos.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./util.mjs";

const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } } });
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }); // só dado fictício
const ped = await db.pedido.create({
  data: {
    contratoId: c45.id, convencaoId: modelo.convencaoId, gatilho: modelo.gatilho, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito,
    dataReferencia: new Date(Date.UTC(2026, 10, 12)), planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora,
    diferencaMensal: modelo.diferencaMensal, diferencaRetroativa: modelo.diferencaRetroativa,
    checklist: { convencao_nova: "ANEXADO", planilha_atual: "ANEXADO" }, passoAtual: 5,
  },
});

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  const salvo = () => p.getByText(/^Salvo/).first().waitFor({ timeout: 60000 });

  // 1) Muda o salário (com fonte): a diferença gravada tem de acompanhar
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/3`);
  const todas = p.getByRole("button", { name: /Mostrar todas/ });
  if (await todas.count()) await todas.first().click();
  await p.getByLabel("Valor em R$ de Salário base").first().fill("1900,00");
  await salvo();
  await p.waitForTimeout(500);
  let x = await db.pedido.findUnique({ where: { id: ped.id } });
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/5`);
  const naTela = (await p.locator(".cartao-numero", { hasText: "Diferença por mês" }).locator(".valor-n").innerText()).replace(/[^\d,]/g, "").replace(",", ".");
  conferir(Number(x.diferencaMensal) === Number(naTela), `diferença gravada (${x.diferencaMensal}) = diferença do documento (${naTela})`);

  // 2) Tira a fonte da linha alterada, "aprova" por fora e tenta gerar
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/3`);
  if (await todas.count()) await todas.first().click();
  await p.getByLabel("Fonte de Salário base").first().fill("");
  await salvo();
  await p.waitForTimeout(500);
  await db.pedido.update({ where: { id: ped.id }, data: { memoriaAprovadaEm: new Date(), memoriaAprovadaPor: "Marcos (exemplo)" } });
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/5`);
  await p.getByRole("button", { name: "Gerar pedido" }).click();
  await p.waitForTimeout(4000);
  x = await db.pedido.findUnique({ where: { id: ped.id } });
  conferir(x.estado === "EM_ANALISE" && !x.geradoEm, `gerar com linha alterada sem fonte é recusado (estado ${x.estado})`);
  const caixa = p.locator(".rodape-assistente").locator("xpath=..").locator(".alerta, [role=alert]");
  const erro = await caixa.allInnerTexts();
  console.log("      mensagem na tela:", JSON.stringify(erro).slice(0, 300));
  conferir(erro.some((t) => /fonte/i.test(t)), "a recusa cita a fonte que falta");
  conferir((await caixa.locator(`a[href$="/passo/3"]`).count()) > 0, "a recusa tem link para o passo 3");
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
