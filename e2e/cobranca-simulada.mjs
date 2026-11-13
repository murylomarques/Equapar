// 4.2: cobrança simulada no navegador. Escolher plano abre a fatura; o plano só muda depois do pagamento.
// Usa a conta fictícia de exemplo e devolve o plano original no fim.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const dono = await db.usuario.findUnique({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
const contaId = dono.membros[0].contaId;
const original = await db.conta.findUnique({ where: { id: contaId }, select: { plano: true, planoPendente: true, ciclo: true, situacaoCobranca: true, carenciaAte: true } });
const faturasAntes = (await db.fatura.findMany({ where: { contaId }, select: { id: true } })).map((f) => f.id);

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  await p.getByRole("radio", { name: /Assessoria/ }).check();
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.getByText(/Cobrança aberta/).first().waitFor();
  let conta = await db.conta.findUnique({ where: { id: contaId } });
  conferir(conta.plano === original.plano && conta.planoPendente === "ASSESSORIA", "escolher o plano abre a cobrança e não muda o plano ainda");
  await p.reload();
  conferir((await p.getByText(/Aguardando pagamento/).count()) > 0, "a tela mostra o plano aguardando pagamento");
  await p.getByRole("button", { name: "Simular pagamento" }).first().click();
  // a fatura sai de "em aberto" (o botão some com ela); o sinal na tela é a fatura paga
  await p.getByText(/· paga/).first().waitFor();
  conta = await db.conta.findUnique({ where: { id: contaId } });
  conferir(conta.plano === "ASSESSORIA" && !conta.planoPendente, "depois do pagamento, o plano passa a valer");
  const nova = await db.fatura.findFirst({ where: { contaId, id: { notIn: faturasAntes } } });
  conferir(nova?.status === "PAGA" && !!nova.pagaEm, "fatura marcada como paga");
  const avisos = await db.aviso.count({ where: { contaId, tipo: "COBRANCA", status: "ENVIADO" } });
  conferir(avisos === 0, "nenhuma mensagem real enviada (simulação)");
} finally {
  await db.fatura.deleteMany({ where: { contaId, id: { notIn: faturasAntes } } });
  await db.conta.update({ where: { id: contaId }, data: original });
  await fim(b);
}
