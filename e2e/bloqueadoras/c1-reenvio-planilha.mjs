// C1: reenviar a planilha atual precisa refazer a planilha nova do passo 3.
// Esperado: depois do 2º envio, a planilha nova tem os mesmos ids da atual e salário 1800.
import ExcelJS from "exceljs";
import path from "node:path";
import { BASE, db, tmp, navegador, entrarComoDono, confirmarSeAbrir, conferir, fim } from "./util.mjs";

async function xlsx(arquivo, salario) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Servente");
  const pct = (d, v) => {
    const r = ws.addRow([d, v]);
    r.getCell(2).numFmt = "0.00%";
  };
  ws.addRow(["Quantidade de postos", 10]);
  ws.addRow(["Módulo 1 - Composição da remuneração"]);
  ws.addRow(["Salário base", salario]);
  ws.addRow(["Submódulo 2.1 - 13º salário, férias e adicional de férias"]);
  pct("13º salário", 0.0833);
  ws.addRow(["Submódulo 2.2 - Encargos previdenciários (GPS), FGTS e outras contribuições"]);
  pct("INSS", 0.2);
  pct("FGTS", 0.08);
  ws.addRow(["Módulo 6 - Custos indiretos, tributos e lucro"]);
  pct("Custos indiretos", 0.03);
  pct("Lucro", 0.05);
  pct("PIS", 0.0165);
  pct("COFINS", 0.076);
  pct("ISS", 0.05);
  await wb.xlsx.writeFile(arquivo);
}

const A = path.join(tmp, "A.xlsx");
const B = path.join(tmp, "B.xlsx");
await xlsx(A, 1740);
await xlsx(B, 1800);

const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: "EM_ANALISE" } }); // só dado fictício de exemplo
const ped = await db.pedido.create({
  data: { contratoId: c45.id, convencaoId: c45.convencaoId, dataBase: new Date(Date.UTC(2026, 0, 1)), dataDeposito: new Date(Date.UTC(2026, 1, 10)), passoAtual: 2 },
});

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  async function enviar(arq) {
    await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/2`);
    await p.locator("input[type=file]").first().setInputFiles(arq);
    const confirmou = await confirmarSeAbrir(p);
    await p.getByText(/Lemos \d+ linhas/).first().waitFor({ timeout: 180000 });
    await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/2`);
    await p.locator(".rodape-assistente").getByRole("button", { name: "Continuar" }).click();
    await p.waitForURL(/passo\/3/, { timeout: 180000 });
    return confirmou;
  }
  conferir((await enviar(A)) === false, "1º envio: sem planilha nova, não pede confirmação");
  conferir((await enviar(B)) === true, "2º envio: pede confirmação antes de refazer a planilha nova");
  const x = await db.pedido.findUnique({ where: { id: ped.id } });
  const sal = (pl) => pl.tipos[0].linhas.find((l) => l.salarioBase)?.valor;
  const ids = (pl) => pl.tipos.map((t) => [t.id, ...t.linhas.map((l) => l.id)].join(",")).join("|");
  conferir(x.planilhaAgora && ids(x.planilhaAgora) === ids(x.planilhaAntes), "planilha nova tem os mesmos ids da planilha atual reenviada");
  conferir(Number(sal(x.planilhaAntes)) === 1800, `planilha atual com salário 1800 (veio ${sal(x.planilhaAntes)})`);
  conferir(x.planilhaAgora && Number(sal(x.planilhaAgora)) === 1800, `planilha nova com salário 1800 (veio ${x.planilhaAgora && sal(x.planilhaAgora)})`);
  // A tela do passo 3 não pode mostrar diferença negativa nem "→ R$ 0,00"
  await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/3`);
  const texto = await p.locator("body").innerText();
  conferir(!/−R\$|-R\$/.test(texto.split("Diferença por mês")[1]?.slice(0, 40) ?? ""), "passo 3 sem diferença negativa");
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
