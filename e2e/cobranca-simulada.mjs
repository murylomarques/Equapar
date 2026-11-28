// 4.2: cobrança simulada no navegador. Escolher plano abre a fatura; o plano só muda depois do pagamento.
// Usa a conta fictícia de exemplo e devolve o plano original no fim.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const dono = await db.usuario.findUnique({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
const contaId = dono.membros[0].contaId;
const original = await db.conta.findUnique({ where: { id: contaId }, select: { plano: true, planoPendente: true, ciclo: true, situacaoCobranca: true, carenciaAte: true, planoVigenteAte: true, renovacaoCancelada: true, mudancaAgendada: true, mudancaAgendadaEm: true } });
// começa de uma conta no Grátis sem período pago (com período pago em andamento, o upgrade vai para análise manual)
await db.conta.update({ where: { id: contaId }, data: { plano: "GRATIS", planoPendente: null, planoVigenteAte: null, renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, situacaoCobranca: "EM_DIA", carenciaAte: null } });
const abertasAntes = await db.fatura.findMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } }, select: { id: true, status: true } });
const faturasAntes = (await db.fatura.findMany({ where: { contaId }, select: { id: true } })).map((f) => f.id);

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  // no modo piloto o Assessoria não aparece; a Carteira passa pelo mesmo fluxo de cobrança
  await p.getByRole("radio", { name: /^Carteira/ }).check();
  conferir((await p.getByRole("radio", { name: /Assessoria/ }).count()) === 0 || process.env.MODO_PILOTO === "false", "no modo piloto, o plano Assessoria não aparece para quem não o tem");
  // fluxo atual: ver o que muda antes de confirmar, depois abrir a cobrança
  await p.getByRole("button", { name: "Ver o que muda" }).click();
  await p.getByRole("button", { name: "Abrir a cobrança" }).click();
  await p.getByText(/Cobrança aberta/).first().waitFor();
  let conta = await db.conta.findUnique({ where: { id: contaId } });
  conferir(conta.plano === "GRATIS" && conta.planoPendente === "CARTEIRA", "escolher o plano abre a cobrança e não muda o plano ainda");
  await p.reload();
  conferir((await p.getByText(/Aguardando pagamento/).count()) > 0, "a tela mostra o plano aguardando pagamento");
  const aberta = await db.fatura.findFirst({ where: { contaId, id: { notIn: faturasAntes }, status: "ABERTA" } });
  await p.locator("li.item-doc", { hasText: aberta.descricao }).filter({ hasText: "em aberto" }).getByRole("button", { name: "Simular pagamento" }).first().click();
  // espera o pagamento ser processado (a fatura nova paga no banco), não um "paga" de faturas antigas
  for (let i = 0; i < 30 && (await db.fatura.findUnique({ where: { id: aberta.id } })).status !== "PAGA"; i++) await p.waitForTimeout(500);
  conta = await db.conta.findUnique({ where: { id: contaId } });
  conferir(conta.plano === "CARTEIRA" && !conta.planoPendente, "depois do pagamento, o plano passa a valer");
  const nova = await db.fatura.findFirst({ where: { contaId, id: { notIn: faturasAntes } } });
  conferir(nova?.status === "PAGA" && !!nova.pagaEm, "fatura marcada como paga");
  const avisos = await db.aviso.count({ where: { contaId, tipo: "COBRANCA", status: "ENVIADO" } });
  conferir(avisos === 0, "nenhuma mensagem real enviada (simulação)");
} finally {
  await db.fatura.deleteMany({ where: { contaId, id: { notIn: faturasAntes } } });
  for (const f of abertasAntes) await db.fatura.update({ where: { id: f.id }, data: { status: f.status, canceladaEm: null, motivoCancelamento: null } });
  await db.conta.update({ where: { id: contaId }, data: original });
  await fim(b);
}
