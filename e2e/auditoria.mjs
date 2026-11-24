// Auditoria total, no navegador: cenários D (aviso leva ao contexto certo), E (plano pago só com pagamento),
// F (cancelamento no fim do período, dados preservados) e G (sem orçamento, a IA paga não é oferecida).
// Só dados fictícios; devolve a conta de exemplo ao estado anterior.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const dono = await db.usuario.findUnique({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
const contaId = dono.membros[0].contaId;
const antes = await db.conta.findUnique({ where: { id: contaId } });
const faturasOriginais = await db.fatura.findMany({ where: { contaId }, select: { id: true, status: true, motivoCancelamento: true } });
const faturasAntes = faturasOriginais.map((f) => f.id);
const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { contaId } } });
const vigenciaAntes = c45.vigenciaFim;

const b = await navegador();
try {
  const p = await entrarComoDono(await b.newContext());

  // ---- D: aviso de prazo com contrato, urgência e atalho para os prazos do contrato certo
  const em5 = new Date(Date.now() + 5 * 86400000);
  await db.contrato.update({ where: { id: c45.id }, data: { vigenciaFim: em5 } });
  await db.aviso.deleteMany({ where: { chave: { startsWith: `D7:${c45.id}:` } } });
  const chave = `D7:${c45.id}:${em5.toISOString().slice(0, 10)}`;
  for (const canal of ["EMAIL", "WHATSAPP"])
    await db.aviso.create({ data: { contaId, contratoId: c45.id, chave, tipo: "D7", canal, destino: canal === "EMAIL" ? "dono@exemplo.local" : "+5527999990000", assunto: "Em 7 dias: contrato 45/2025", corpo: "Texto com link qualquer https://exemplo.invalid/x", status: "SIMULADO" } });
  await p.goto(`${BASE}/app/avisos`);
  const item = p.locator("li.aviso-item", { hasText: "Contrato 45/2025: fim da vigência" });
  conferir((await item.count()) === 1, "e-mail e WhatsApp do mesmo prazo aparecem como um aviso só");
  conferir((await item.getByText("Urgente").count()) === 1, "o aviso mostra a urgência");
  await item.getByRole("link", { name: /Ver prazos do contrato/ }).click();
  await p.waitForURL(new RegExp(`/app/contratos/${c45.id}\\?aba=prazos`));
  conferir(true, "o clique leva aos prazos do contrato certo");

  // ---- E: escolher Carteira mostra a previsão; o plano só muda com o pagamento
  await db.fatura.updateMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } }, data: { status: "CANCELADA", motivoCancelamento: "teste de auditoria" } });
  await db.conta.update({ where: { id: contaId }, data: { plano: "GRATIS", planoPendente: null, planoVigenteAte: null, renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, situacaoCobranca: "EM_DIA", carenciaAte: null } });
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  await p.getByRole("radio", { name: /^Carteira/ }).check();
  await p.getByRole("button", { name: "Ver o que muda" }).click();
  await p.getByText("Contratar o plano").waitFor();
  conferir((await p.getByText(/passa a valer quando o pagamento for confirmado/).count()) > 0, "antes de confirmar, a tela diz quando o plano passa a valer");
  await p.getByRole("button", { name: "Abrir a cobrança" }).click();
  await p.getByText(/Cobrança aberta/).first().waitFor();
  let c = await db.conta.findUnique({ where: { id: contaId } });
  conferir(c.plano === "GRATIS", "abrir a cobrança não libera o plano pago");
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  await p.getByRole("button", { name: "Simular pagamento" }).first().click();
  await p.getByText("Período pago até").waitFor();
  c = await db.conta.findUnique({ where: { id: contaId } });
  conferir(c.plano === "CARTEIRA" && !!c.planoVigenteAte, `pagamento confirmado: Carteira até ${c.planoVigenteAte?.toISOString().slice(0, 10)}`);

  // ---- F: cancelar a renovação mostra a data; o acesso pago continua; dá para desfazer
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  await p.getByRole("link", { name: "Cancelar a renovação" }).click();
  await p.getByRole("button", { name: "Confirmar o cancelamento" }).waitFor();
  const dataBr = c.planoVigenteAte.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  conferir((await p.getByText(new RegExp(`até ${dataBr.replace(/\//g, "\\/")}`)).count()) > 0, `a previsão mostra a data efetiva (${dataBr})`);
  conferir((await p.getByText(/podem ser exportados/).count()) > 0, "a previsão diz que os dados ficam e podem ser exportados");
  await p.getByRole("button", { name: "Confirmar o cancelamento" }).click();
  await p.getByText(/Renovação cancelada/).first().waitFor();
  c = await db.conta.findUnique({ where: { id: contaId } });
  conferir(c.plano === "CARTEIRA" && c.renovacaoCancelada && c.mudancaAgendada === "GRATIS", "o plano pago segue até o fim do período, com a mudança programada");
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  conferir((await p.getByText(/Renovação cancelada: passa para o Grátis/).count()) === 1, "a tela mostra a mudança programada");
  await p.getByRole("link", { name: "Manter a assinatura" }).click();
  await p.getByRole("button", { name: "Manter a assinatura" }).click();
  await p.getByRole("link", { name: "Cancelar a renovação" }).waitFor();
  c = await db.conta.findUnique({ where: { id: contaId } });
  conferir(!c.renovacaoCancelada && !c.mudancaAgendada, "desfazer o cancelamento antes da data mantém a assinatura");

  // ---- G: sem orçamento configurado (padrão), o passo 2 não oferece leitura de PDF com IA
  const pedido = await db.pedido.findFirst({ where: { contrato: { empresa: { contaId } }, estado: "EM_ANALISE" } });
  if (pedido) {
    await p.goto(`${BASE}/app/pedidos/${pedido.id}/passo/2`);
    await p.locator("main h1").first().waitFor();
    conferir((await p.getByText(/Leitura de PDF com IA/).count()) === 0, "sem orçamento de IA: a leitura com IA não aparece; Excel e digitação seguem");
  }
  conferir((await db.usoIa.count({ where: { contaId } })) === 0, "nenhum consumo de IA registrado para a conta");
} finally {
  await db.aviso.deleteMany({ where: { chave: { startsWith: `D7:${c45.id}:` } } });
  await db.contrato.update({ where: { id: c45.id }, data: { vigenciaFim: vigenciaAntes } });
  await db.fatura.deleteMany({ where: { contaId, id: { notIn: faturasAntes } } });
  await db.conta.update({
    where: { id: contaId },
    data: { plano: antes.plano, planoPendente: antes.planoPendente, planoVigenteAte: antes.planoVigenteAte, renovacaoCancelada: antes.renovacaoCancelada, mudancaAgendada: antes.mudancaAgendada, mudancaAgendadaEm: antes.mudancaAgendadaEm, situacaoCobranca: antes.situacaoCobranca, carenciaAte: antes.carenciaAte, ciclo: antes.ciclo },
  });
  for (const f of faturasOriginais) await db.fatura.update({ where: { id: f.id }, data: { status: f.status, motivoCancelamento: f.motivoCancelamento } });
  await fim(b);
}
