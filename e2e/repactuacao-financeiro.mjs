// Nove correções (itens 6 a 9) no navegador, pelo caminho real da tela e das rotas de download:
// URL direta do pacote final bloqueada sem versão aprovada, deferimento parcial e apostilamento,
// notas fiscais parciais com reenvio idempotente e baixas parciais, inclusive concorrentes.
// Só dados fictícios; apaga o que cria e devolve o valor mensal do contrato.
import { BASE, db, navegador, entrarComoDono, conferir, fim } from "./bloqueadoras/util.mjs";

const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } });
const modelo = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresaId: c45.empresaId } } });
const outraConta = await db.pedido.findFirst({ where: { contrato: { empresa: { conta: { tipo: "ASSESSORIA", demo: false } } } } });
const mensalOriginal = c45.valorMensal;
const ultimoApostilamentoOriginal = c45.ultimoApostilamento;

const { id: _i, criadoEm: _c, atualizadoEm: _a, ...copia } = modelo;
const pedido = await db.pedido.create({
  data: {
    ...copia,
    contratoId: c45.id,
    estado: "PROTOCOLADO",
    protocoloNumero: "E2E-NOVE-1",
    protocoloData: new Date(Date.now() - 20 * 86400000),
    documentacaoCompletaEm: new Date(Date.now() - 18 * 86400000),
    memoriaAprovadaEm: null,
    memoriaAprovadaPor: null,
    memoriaVersaoAprovadaId: null,
    pedidoOrigemId: null,
  },
});
const reais = (v) => Number(v).toFixed(2);
const resumo = async () => {
  const p = await db.pedido.findUnique({ where: { id: pedido.id }, include: { notasFiscais: { where: { canceladaEm: null } }, baixas: { where: { canceladaEm: null } } } });
  const faturado = p.notasFiscais.reduce((s, n) => s + Number(n.valor), 0);
  const recebido = p.baixas.reduce((s, b) => s + Number(b.valor), 0);
  return { p, faturado: reais(faturado), recebido: reais(recebido), aReceber: reais(faturado - recebido), notas: p.notasFiscais, baixas: p.baixas };
};

const b = await navegador();
try {
  const pg = await entrarComoDono(await b.newContext());
  const url = `${BASE}/app/pedidos/${pedido.id}/pronto`;

  // ---- Item 6: arquivos finais por URL direta
  const zip = await pg.request.get(`${BASE}/api/pedidos/${pedido.id}/arquivos/pacote.zip`);
  conferir(zip.status() === 409, `ZIP final por URL direta sem versão aprovada: recusado (veio ${zip.status()})`);
  const pdf = await pg.request.get(`${BASE}/api/pedidos/${pedido.id}/arquivos/memoria.pdf`);
  conferir(pdf.status() === 409, `PDF final por URL direta sem versão aprovada: recusado (veio ${pdf.status()})`);
  const prev = await pg.request.get(`${BASE}/api/pedidos/${pedido.id}/arquivos/pacote.zip?rascunho=1`);
  conferir(prev.status() === 200 && prev.headers()["x-equapar-versao"] === "RASCUNHO" && /RASCUNHO-/.test(prev.headers()["content-disposition"] ?? ""), "prévia autorizada sai identificada como RASCUNHO");
  if (outraConta) {
    const alheio = await pg.request.get(`${BASE}/api/pedidos/${outraConta.id}/arquivos/pacote.zip?rascunho=1`);
    conferir(alheio.status() === 404, `pacote de outra conta: 404 (veio ${alheio.status()})`);
  }

  // ---- Item 7: deferimento parcial
  await pg.goto(url);
  await pg.getByText("Deferido parcialmente").click();
  const solicitadoTxt = await pg.getByRole("textbox", { name: "Valor mensal aprovado" }).inputValue();
  const retroSolicitadoTxt = await pg.getByRole("textbox", { name: "Retroativo aprovado" }).inputValue();
  const num = (t) => Number(String(t).replace(/[^\d,]/g, "").replace(",", "."));
  const solicitado = num(solicitadoTxt);
  const mensalAprovado = (solicitado >= 59000 ? 59000 : solicitado - 1000).toFixed(2);
  const br = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const retroAprovado = Math.min(31540.2, num(retroSolicitadoTxt)).toFixed(2);
  await pg.getByRole("textbox", { name: "Valor mensal aprovado" }).fill(br(mensalAprovado));
  await pg.getByRole("textbox", { name: "Retroativo aprovado" }).fill(br(retroAprovado));
  // sem fundamento o parcial é recusado no servidor
  await pg.getByRole("button", { name: "Registrar resposta" }).click();
  await pg.getByText(/informe o fundamento/i).first().waitFor();
  conferir((await db.pedido.findUnique({ where: { id: pedido.id } })).estado === "PROTOCOLADO", "parcial sem fundamento: recusado no servidor");
  await pg.getByLabel("Fundamento ou documento da decisão").fill("Decisão fictícia de deferimento parcial (teste).");
  await pg.getByRole("button", { name: "Registrar resposta" }).click();
  await pg.getByRole("heading", { name: "Próximo passo: o apostilamento" }).waitFor();
  let x = (await resumo()).p;
  conferir(x.estado === "DEFERIDO" && x.decisaoTipo === "DEFERIDO_PARCIAL", "deferimento parcial registrado");
  conferir(reais(x.mensalSolicitado) === reais(solicitado) && reais(x.mensalAprovado) === mensalAprovado, `mensal solicitado ${reais(x.mensalSolicitado)} e aprovado ${reais(x.mensalAprovado)} separados`);
  conferir(reais(x.retroativoAprovado) === retroAprovado, `retroativo aprovado separado: ${reais(x.retroativoAprovado)}`);

  // apostilamento: o mensal vigente passa a ser o aprovado, com histórico do anterior
  await pg.goto(url);
  await pg.getByRole("button", { name: "Registrar apostilamento" }).click();
  await pg.getByRole("heading", { name: "Próximo passo: faturar a diferença" }).waitFor();
  const c = await db.contrato.findUnique({ where: { id: c45.id } });
  const hist = await db.valorMensalContrato.findFirst({ where: { pedidoId: pedido.id } });
  conferir(reais(c.valorMensal) === mensalAprovado, `apostilamento grava o mensal aprovado (${reais(c.valorMensal)}) como vigente`);
  conferir(!!hist && reais(hist.valorAnterior) === reais(mensalOriginal) && hist.ato === "APOSTILAMENTO", "histórico do valor mensal guarda o anterior e o ato");

  if (retroAprovado !== "31540.20") console.log(`(retroativo do cálculo menor que 31.540,20: usando ${retroAprovado})`);
  const aprov = Number(retroAprovado);

  // ---- Item 8: notas fiscais
  const registrarNota = async (numero, valor, ref) => {
    await pg.goto(url);
    await pg.getByLabel("Número da nota fiscal").fill(numero);
    await pg.getByLabel("Valor desta nota").fill(br(valor));
    await pg.getByLabel("Referência da operação").fill(ref);
    await pg.getByRole("button", { name: "Registrar nota fiscal" }).click();
    await pg.locator("[role=status], [role=alert], .alerta").filter({ hasText: /registrada|supera|Já existe|duplicado/ }).first()
      .or(pg.getByRole("heading", { name: "Próximo passo: confirmar o recebimento" })).first().waitFor();
    await pg.waitForLoadState("networkidle");
  };
  const primeira = Math.min(20000, aprov - 1000);
  await registrarNota("NF-E2E-1", primeira, "op-nf-1");
  let r = await resumo();
  conferir(r.faturado === reais(primeira) && reais(aprov - primeira) === reais(aprov - Number(r.faturado)), `nota parcial: faturado ${r.faturado}, falta faturar ${reais(aprov - primeira)}`);
  await pg.goto(url);
  const faltaTela = await pg.locator("dt", { hasText: "Falta faturar" }).locator("xpath=following-sibling::dd").innerText();
  conferir(num(faltaTela).toFixed(2) === reais(aprov - primeira), `tela mostra falta faturar ${faltaTela}`);
  await registrarNota("NF-E2E-1", primeira, "op-nf-1");
  r = await resumo();
  conferir(r.faturado === reais(primeira) && r.notas.length === 1, "reenvio da mesma nota não aumenta o faturado");
  await registrarNota("NF-E2E-2", aprov, "op-nf-2");
  r = await resumo();
  conferir(r.notas.length === 1 && (await pg.getByText(/supera o saldo/).count()) > 0, "nota acima do saldo: recusada com a mensagem do saldo");
  await registrarNota("NF-E2E-2", aprov - primeira, "op-nf-2");
  r = await resumo();
  conferir(r.faturado === reais(aprov) && r.p.estado === "FATURADO", `toda a diferença faturada: ${r.faturado}`);

  // ---- Item 9: baixas parciais
  const nf1 = r.notas.find((n) => n.identificacao === "NF-E2E-1");
  const baixar = async (pagina, valor, ref, notaId = nf1.id) => {
    await pagina.goto(url);
    await pagina.getByLabel("Nota fiscal").selectOption(notaId);
    await pagina.getByLabel("Valor recebido").fill(br(valor));
    await pagina.getByLabel("Referência da baixa").fill(ref);
    await pagina.getByRole("button", { name: "Registrar recebimento" }).click();
    await pagina.locator("[role=status], [role=alert], .alerta").filter({ hasText: /Recebimento|Recebido|supera|maior que zero|duplicado|Informe/ }).first()
      .or(pagina.getByRole("heading", { name: "A diferença entrou no caixa." })).first().waitFor();
    await pagina.waitForLoadState("networkidle");
  };
  await baixar(pg, 1000, "op-baixa-1");
  r = await resumo();
  conferir(r.aReceber === reais(aprov - 1000) && r.p.estado === "FATURADO", `baixa de 1.000,00: ${r.aReceber} a receber, pedido segue em aberto`);
  await baixar(pg, 1000, "op-baixa-1");
  r = await resumo();
  conferir(r.baixas.length === 1 && r.aReceber === reais(aprov - 1000), "reenvio da mesma baixa mantém o saldo");
  await baixar(pg, 0, "op-baixa-zero");
  r = await resumo();
  conferir(r.baixas.length === 1, "baixa de valor zero: recusada");
  await baixar(pg, primeira, "op-baixa-acima");
  r = await resumo();
  conferir(r.baixas.length === 1 && (await pg.getByText(/supera o saldo/).count()) > 0, "baixa acima do saldo da nota: recusada");

  // duas baixas concorrentes que, juntas, passam do saldo da nota: só uma entra
  const resto = primeira - 1000;
  const pg2 = await entrarComoDono(await b.newContext());
  await Promise.all([baixar(pg, resto, "op-conc-a"), baixar(pg2, resto, "op-conc-b")]);
  r = await resumo();
  const nf1Recebido = r.baixas.filter((bx) => bx.notaFiscalId === nf1.id).reduce((s, bx) => s + Number(bx.valor), 0);
  conferir(reais(nf1Recebido) === reais(primeira) && r.baixas.length === 2, `baixas concorrentes: só uma entra (recebido na NF-1 ${reais(nf1Recebido)})`);
  conferir(r.p.estado === "FATURADO", "com a segunda nota em aberto, o pedido não está quitado");

  // quitação: recebe a segunda nota
  const nf2 = r.notas.find((n) => n.identificacao === "NF-E2E-2");
  await baixar(pg, aprov - primeira, "op-baixa-final", nf2.id);
  r = await resumo();
  conferir(r.p.estado === "RECEBIDO" && r.aReceber === "0.00", "toda a diferença faturada e recebida: pedido quitado");
  await pg.goto(url);
  await pg.getByRole("heading", { name: "Notas fiscais e recebimentos" }).waitFor();
  const refs = await pg.getByText(/ref\. op-/).allInnerTexts();
  conferir(refs.length === 3, `depois da quitação, o pedido mostra o histórico integral das baixas (${refs.length})`);
} finally {
  await db.valorMensalContrato.deleteMany({ where: { pedidoId: pedido.id } });
  await db.contrato.update({ where: { id: c45.id }, data: { valorMensal: mensalOriginal, ultimoApostilamento: ultimoApostilamentoOriginal } });
  await db.historico.deleteMany({ where: { pedidoId: pedido.id } });
  await db.baixaPedido.deleteMany({ where: { pedidoId: pedido.id } });
  await db.notaFiscalPedido.deleteMany({ where: { pedidoId: pedido.id } });
  await db.memoriaVersao.deleteMany({ where: { pedidoId: pedido.id } });
  await db.pedido.delete({ where: { id: pedido.id } });
  await fim(b);
}
