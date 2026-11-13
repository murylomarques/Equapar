// 5.1: pedido da jornada (EC 141/2026) no navegador. Filtro da Carteira, lote, passo 1 sem convenção,
// passo 3 com os dois cenários e escolha obrigatória, minuta do aditivo. Apaga só os pedidos que criou.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const dono = await db.usuario.findUnique({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
const contaId = dono.membros[0].contaId;
const antes = new Set((await db.pedido.findMany({ where: { contrato: { empresa: { contaId } } }, select: { id: true } })).map((p) => p.id));
const comPlanilha = await db.pedido.findFirst({ where: { contrato: { empresa: { contaId } }, NOT: { planilhaAntes: { equals: null } } }, select: { planilhaAntes: true } });

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  await p.goto(`${BASE}/app/carteira?filtro=jornada`);
  const filtro = p.getByRole("link", { name: /Afetados pela jornada de 40 horas/ });
  await filtro.first().waitFor(); // a Carteira chega por streaming, depois do esqueleto
  conferir((await filtro.count()) === 1, "Carteira tem o filtro Afetados pela jornada de 40 horas");
  const botao = p.getByRole("button", { name: /Montar os pedidos destes \d+ contratos/ });
  conferir((await botao.count()) === 1, "com o filtro, aparece o botão de montar os pedidos em lote");
  await botao.click();
  await p.waitForURL(/\/app\/pedidos/);
  const novos = await db.pedido.findMany({ where: { contrato: { empresa: { contaId } }, id: { notIn: [...antes] } } });
  conferir(novos.length > 0 && novos.every((n) => n.gatilho === "JORNADA_EC141" && !n.convencaoId), `lote criou ${novos.length} pedidos da jornada, sem convenção`);

  const alvo = novos[0];
  await db.pedido.update({ where: { id: alvo.id }, data: { planilhaAntes: comPlanilha.planilhaAntes, planilhaAgora: null } });
  await p.goto(`${BASE}/app/pedidos/${alvo.id}/passo/1`);
  conferir(await p.getByRole("radio", { name: /jornada \(EC 141\/2026\)/ }).isChecked(), "passo 1 vem com o motivo jornada marcado");
  conferir(await p.getByLabel("Início da nova jornada").isVisible(), "campos da jornada aparecem");
  conferir(!(await p.getByText("Data do depósito da convenção").isVisible()), "campos da convenção ficam escondidos");
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForURL(/passo\/2/);
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForURL(/passo\/3/);
  conferir((await p.getByText("Manter as horas de serviço").count()) === 1 && (await p.getByText("Reduzir as horas de serviço").count()) === 1, "passo 3 mostra os dois cenários lado a lado");
  conferir(!(await p.getByRole("radio", { name: /Manter as horas/ }).isChecked()) && !(await p.getByRole("radio", { name: /Reduzir as horas/ }).isChecked()), "nenhum cenário vem marcado");
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(800);
  conferir(/passo\/3/.test(p.url()), "sem escolher o cenário, não avança");
  await p.getByRole("radio", { name: /Manter as horas/ }).check();
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForURL(/passo\/4/);
  const salvo = await db.pedido.findUnique({ where: { id: alvo.id } });
  conferir(salvo.cenarioJornada === "MANTER_HORAS" && Number(salvo.diferencaMensal) > 0, "cenário gravado e diferença positiva");
  const r = await p.request.get(`${BASE}/api/pedidos/${alvo.id}/arquivos/aditivo.pdf`);
  conferir(r.status() === 200 && (await r.body()).subarray(0, 4).toString() === "%PDF", "minuta do aditivo sai em PDF");
  const o = await p.request.get(`${BASE}/api/pedidos/${alvo.id}/arquivos/oficio.docx`);
  conferir(o.status() === 200, "ofício da jornada sai");
} finally {
  const criados = await db.pedido.findMany({ where: { contrato: { empresa: { contaId } }, id: { notIn: [...antes] } }, select: { id: true } });
  const ids = criados.map((c) => c.id);
  await db.historico.deleteMany({ where: { pedidoId: { in: ids } } });
  await db.pedido.deleteMany({ where: { id: { in: ids } } });
  await fim(b);
}
