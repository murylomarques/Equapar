// S4: o conteúdo real do arquivo precisa bater com a extensão; download com nome acentuado correto.
import fs from "node:fs";
import path from "node:path";
import { BASE, db, tmp, navegador, entrarComoDono, conferir, fim } from "./util.mjs";

const falso = path.join(tmp, "convencao-falsa.pdf");
fs.writeFileSync(falso, "<html><script>alert(1)</script></html>");
const verdadeiro = path.join(tmp, "Convenção.pdf");
fs.writeFileSync(verdadeiro, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true } } } });
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true } } });
await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }); // só dado fictício
const ped = await db.pedido.create({
  data: { contratoId: c45.id, convencaoId: modelo.convencaoId, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito, planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora, passoAtual: 4 },
});

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  const enviar = async (arq) => {
    await p.goto(`${BASE}/app/pedidos/${ped.id}/passo/4`);
    await p.locator("li", { hasText: "Convenção coletiva nova" }).locator('input[type="file"]').setInputFiles(arq);
    await p.waitForTimeout(5000);
  };
  await enviar(falso);
  let docs = await db.documento.findMany({ where: { pedidoId: ped.id } });
  conferir(docs.length === 0, `HTML disfarçado de PDF é recusado (${docs.length} anexado)`);
  await enviar(verdadeiro);
  docs = await db.documento.findMany({ where: { pedidoId: ped.id } });
  conferir(docs.length === 1 && docs[0].mime === "application/pdf", "PDF de verdade é aceito e gravado com o tipo detectado");
  if (docs[0]) {
    const r = await p.request.get(`${BASE}/api/documentos/${docs[0].id}`);
    const cd = r.headers()["content-disposition"] ?? "";
    console.log("      content-disposition:", cd);
    conferir(/filename\*=UTF-8''Conven%C3%A7%C3%A3o\.pdf/.test(cd) && /attachment/.test(cd), "download como anexo com o nome acentuado em filename*");
  }
} finally {
  await db.pedido.deleteMany({ where: { id: ped.id } });
  await fim(b);
}
