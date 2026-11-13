// A1/A2: nenhuma tela principal pode ter rolagem lateral na página, em 390, 1.280 e 1.440 px.
// Precisa do servidor com PAINEL_EMAILS incluindo dono@exemplo.local (para medir o painel interno).
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } });
const prot = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresaId: c45.empresaId } } });
const ped = await db.pedido.create({
  data: { contratoId: c45.id, convencaoId: prot.convencaoId, dataBase: prot.dataBase, dataDeposito: prot.dataDeposito, planilhaAntes: prot.planilhaAntes, planilhaAgora: prot.planilhaAgora, passoAtual: 5 },
});
const ROTAS = [
  "/app/hoje", "/app/carteira", "/app/pedidos",
  ...[1, 2, 3, 4, 5].map((n) => `/app/pedidos/${ped.id}/passo/${n}`),
  `/app/pedidos/${ped.id}/memoria`, "/app/a-receber", "/app/convencoes", "/app/configuracoes", "/app/interno",
];
const b = await navegador();
try {
  for (const largura of [390, 1280, 1440]) {
    const p = await entrarComoDono(await b.newContext({ viewport: { width: largura, height: 900 } }));
    for (const r of ROTAS) {
      await p.goto(`${BASE}${r}`);
      await p.waitForLoadState("networkidle");
      await p.locator("main h1").first().waitFor();
      const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      conferir(m.s <= m.c, `${largura}px ${r}: largura ${m.s} ≤ ${m.c}`);
    }
    await p.context().close();
  }
} finally {
  await db.pedido.delete({ where: { id: ped.id } });
  await fim(b);
}
