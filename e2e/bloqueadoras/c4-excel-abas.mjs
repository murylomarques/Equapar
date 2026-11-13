// C4: o Excel do pedido sai mesmo com postos de nomes parecidos (antes: "Worksheet name already exists").
import ExcelJS from "exceljs";
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./util.mjs";

const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } } });
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }); // só dado fictício
const renomear = (pl) => {
  const t = pl.tipos[0];
  const copia = (nome, sufixo) => ({ ...t, id: `${t.id}-${sufixo}`, nome, linhas: t.linhas.map((l) => ({ ...l, id: `${l.id}-${sufixo}` })) });
  return { tipos: [copia("Auxiliar de limpeza 44h diurno", "d"), copia("Auxiliar de limpeza 44h noturno", "n")] };
};
const ped = await db.pedido.create({
  data: {
    contratoId: c45.id, convencaoId: modelo.convencaoId, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito,
    dataReferencia: new Date(Date.UTC(2026, 10, 12)), planilhaAntes: renomear(modelo.planilhaAntes), planilhaAgora: renomear(modelo.planilhaAgora), passoAtual: 5,
  },
});

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  const r = await p.request.get(`${BASE}/api/pedidos/${ped.id}/arquivos/planilha.xlsx`, { timeout: 180000 });
  conferir(r.status() === 200, `Excel do pedido com postos parecidos baixa (status ${r.status()})`);
  if (r.status() === 200) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.body());
    const nomes = wb.worksheets.map((w) => w.name);
    console.log("      abas:", nomes.join(" | "));
    conferir(nomes.length === 6 && new Set(nomes.map((n) => n.toLowerCase())).size === 6, "6 abas com nomes distintos (2 postos × 2 planilhas + comparativo + retroativo)");
  }
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
