// Fase 2 no navegador: navegação do celular, recurso e novo pedido depois do indeferimento, Recuperado,
// histórico do órgão, demonstração de assessoria e isolamento entre contas. Só dados fictícios; apaga o que cria.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } });
const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresaId: c45.empresaId } } });
const outraConta = await db.pedido.findFirst({ where: { contrato: { empresa: { conta: { tipo: "ASSESSORIA", demo: false } } } }, include: { contrato: true } });
const criados = [];
const indef = await db.pedido.create({
  data: {
    contratoId: c45.id, convencaoId: modelo.convencaoId, gatilho: modelo.gatilho, dataBase: modelo.dataBase, dataDeposito: modelo.dataDeposito,
    planilhaAntes: modelo.planilhaAntes, planilhaAgora: modelo.planilhaAgora, passoAtual: 5, estado: "INDEFERIDO",
    protocoloData: new Date(Date.now() - 40 * 86400000), respostaData: new Date(Date.now() - 5 * 86400000), respostaResumo: "Indeferido por falta de prova (exemplo).",
  },
});
criados.push(indef.id);
const doc = await db.documento.create({ data: { pedidoId: indef.id, contratoId: c45.id, tipo: "OUTRO", nome: "exemplo.pdf", mime: "application/pdf", tamanho: 4, caminho: "teste-fase2/inexistente.pdf" } });

const b = await navegador();
try {
  // 1) celular: barra inferior com 5 itens e "Mais"
  const cel = await entrarComoDono(await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
  await cel.goto(`${BASE}/app/hoje`);
  const barra = cel.getByRole("navigation", { name: "Navegação no celular" });
  await barra.waitFor();
  const itens = await barra.getByRole("link").allInnerTexts();
  conferir(["Hoje", "Carteira", "Pedidos", "A receber", "Mais"].every((t) => itens.some((x) => x.includes(t))) && itens.length === 5, `celular: 5 itens na barra (${itens.map((x) => x.split("\n")[0]).join(", ")})`);
  await barra.getByRole("link", { name: /Mais/ }).click();
  await cel.waitForURL(/\/app\/mais/);
  conferir((await cel.getByRole("link", { name: /Convenções/ }).count()) > 0, "celular: Mais leva a Convenções, Avisos e Configurações");

  // 2) recurso e novo pedido a partir do indeferido
  const p = await entrarComoDono(await b.newContext());
  await p.goto(`${BASE}/app/pedidos/${indef.id}/pronto`);
  await p.waitForLoadState("networkidle");
  const prazo = new Date(Date.now() + 10 * 86400000);
  const br = `${String(prazo.getUTCDate()).padStart(2, "0")}/${String(prazo.getUTCMonth() + 1).padStart(2, "0")}/${prazo.getUTCFullYear()}`;
  await p.getByLabel("Prazo do recurso").fill(br);
  await p.getByRole("button", { name: "Registrar recurso" }).click();
  await p.getByText(/Recurso registrado/).first().waitFor();
  let x = await db.pedido.findUnique({ where: { id: indef.id } });
  conferir(!!x.recursoPrazo && !x.recursoData, "recurso: prazo gravado, ainda não apresentado");
  conferir((await db.historico.count({ where: { pedidoId: indef.id, acao: { contains: "recurso" } } })) === 1, "recurso entra no histórico");
  await p.goto(`${BASE}/app/hoje`);
  await p.getByText("Apresentar o recurso").first().waitFor();
  conferir(true, "recurso aparece em Precisa de você");

  await p.goto(`${BASE}/app/pedidos/${indef.id}/pronto`);
  await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Começar um novo pedido a partir deste" }).click();
  await p.waitForURL((u) => /\/app\/pedidos\/[^/]+/.test(u.pathname) && !u.pathname.includes(indef.id));
  const novo = await db.pedido.findFirst({ where: { pedidoOrigemId: indef.id } });
  if (novo) criados.push(novo.id);
  conferir(!!novo && novo.estado === "EM_ANALISE" && JSON.stringify(novo.planilhaAgora) === JSON.stringify(modelo.planilhaAgora), "novo pedido reaproveita as planilhas e começa em análise");

  // 3) Recuperado e histórico do órgão
  await p.goto(`${BASE}/app/recuperado`);
  await p.getByRole("heading", { name: "Por contrato" }).waitFor();
  conferir((await p.getByText("Total recebido").count()) === 1, "Recuperado mostra totais, por ano e por contrato");
  await p.goto(`${BASE}/app/contratos/${c45.id}?aba=resumo`);
  await p.getByRole("heading", { name: "Sua história com este órgão" }).waitFor();
  conferir((await p.getByText(/Só pedidos desta conta/).count()) === 1, "contrato mostra o histórico do órgão só da conta");

  // 4) isolamento: pedido e documento de outra conta não abrem
  const r1 = await p.request.get(`${BASE}/app/pedidos/${outraConta.id}/pronto`);
  const outroDoc = await db.documento.findFirst({ where: { pedido: { contrato: { empresa: { conta: { tipo: "ASSESSORIA" } } } } } });
  // com o esqueleto de carregamento, a resposta já saiu com 200 quando o "não encontrado" chega: confere o conteúdo
  const t1 = await r1.text();
  conferir(!t1.includes(outraConta.contrato.orgao) && !t1.includes(outraConta.contrato.numero) && /404|não encontrad/i.test(t1), "pedido de outra conta: não encontrado, sem nenhum dado dela");
  if (outroDoc) {
    const r2 = await p.request.get(`${BASE}/api/documentos/${outroDoc.id}`);
    conferir(r2.status() === 404, `documento de outra conta: 404 (veio ${r2.status()})`);
  }
  const r3 = await p.request.get(`${BASE}/api/documentos/${doc.id}?ver=1`);
  conferir([200, 410].includes(r3.status()), "documento da própria conta: acesso liberado");

  // 5) demonstração de assessoria com 3 clientes, a partir da página Para assessorias
  const v = await b.newContext();
  const vp = await v.newPage();
  await vp.goto(`${BASE}/assessorias`);
  await vp.getByRole("button", { name: "Ver a demonstração com 3 clientes" }).click();
  await vp.waitForURL(/\/app\/hoje/, { timeout: 120000 });
  const opcoes = await vp.locator(".app-topo select option").allInnerTexts();
  conferir(opcoes.filter((o) => /fictícia/.test(o)).length === 3, `demonstração de assessoria com 3 clientes fictícios (${opcoes.length} opções)`);
  conferir((await vp.getByRole("link", { name: /Marcar uma conversa/ }).count()) === 0, "visitante entra no produto");
} finally {
  await db.documento.deleteMany({ where: { pedidoId: { in: criados } } });
  await db.historico.deleteMany({ where: { pedidoId: { in: criados } } });
  await db.pedido.deleteMany({ where: { id: { in: criados } } });
  await fim(b);
}
