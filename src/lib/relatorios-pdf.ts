import "server-only";
import { db } from "./db";
import { contratosDoContexto } from "./consultas";
import { pedidoDaConta, type Contexto } from "./auth";
import { contratosComPrazoEm, proximoPrazo } from "./prazos";
import { data, dataLocal, hojeUTC, plural } from "./format";
import { brl } from "./calculo/motor";
import { COR, Pdf } from "./pdf";
import { logoDe, marcaDaConta } from "./documentos";
import { NOME_ESTADO } from "./pedido";
import { ErroUsuario } from "./acao";
import { resumoFinanceiro } from "./financeiro-pedido";
import { origemDoValor, pedidosEmAndamento, relatorioDoAno, ESTADOS_EM_ANDAMENTO, textoCasoPronto, valorMensalReferencia, type PedidoDoAno } from "./relatorios";

const LIMITE_CONTRATOS = 14;

/** Pedidos da conta (e do cliente escolhido, em assessoria), inclusive de contratos arquivados. */
function escopoConta(ctx: Contexto) {
  return { contrato: { empresa: { contaId: ctx.conta.id, ...(ctx.empresaId ? { id: ctx.empresaId } : {}) } } };
}

async function pdfDaConta(ctx: Contexto, rodape: string) {
  const m = marcaDaConta(ctx.conta);
  return { pdf: await Pdf.criar(`${rodape} · ${m.nome}`, m.cor, await logoDe(m.logo)), marca: m };
}

const nomeDaVisao = (ctx: Contexto) => ctx.empresaSelecionada?.razaoSocial ?? ctx.conta.nome;

// ---------------------------------------------------------------------------
// Resumo para o sócio
// ---------------------------------------------------------------------------

export async function dadosResumoSocio(ctx: Contexto, hoje = hojeUTC()) {
  const contratos = await contratosDoContexto(ctx);
  const proximos = contratosComPrazoEm(contratos, 90, hoje)
    .map((c) => ({ c, prazo: proximoPrazo(c, hoje)! }))
    .sort((a, b) => a.prazo.data.getTime() - b.prazo.data.getTime());
  const historicos = proximos.length
    ? await db.valorMensalContrato.findMany({ where: { contratoId: { in: proximos.map((x) => x.c.id) } }, select: { contratoId: true, valorNovo: true, aplicavelEm: true } })
    : [];
  const pedidos = await db.pedido.findMany({
    where: { ...escopoConta(ctx), contrato: { ...escopoConta(ctx).contrato, arquivado: false }, estado: { in: [...ESTADOS_EM_ANDAMENTO] } },
    select: {
      estado: true,
      diferencaMensal: true,
      diferencaRetroativa: true,
      retroativoAprovado: true,
      valorDeferido: true,
      notasFiscais: { select: { id: true, valor: true, canceladaEm: true } },
      baixas: { select: { notaFiscalId: true, valor: true, canceladaEm: true } },
    },
  });
  return {
    hoje,
    vencem: proximos.map(({ c, prazo }) => ({
      id: c.id,
      numero: c.numero,
      orgao: c.orgao,
      prazo: { titulo: prazo.titulo, data: prazo.data },
      referencia: valorMensalReferencia(c, historicos.filter((h) => h.contratoId === c.id), hoje),
    })),
    ...pedidosEmAndamento(pedidos),
  };
}

export async function resumoSocioPdf(ctx: Contexto) {
  const d = await dadosResumoSocio(ctx);
  const { pdf } = await pdfDaConta(ctx, `Resumo para o sócio · ${dataLocal(new Date())}`);
  pdf.titulo("Resumo para o sócio", 18);
  pdf.texto(`${nomeDaVisao(ctx)} · situação em ${data(d.hoje)}`, { cor: COR.grafite, espaco: 10 });

  const emAndamento = d.porSituacao.reduce((s, x) => s + x.quantidade, 0);
  pdf.texto(`Deferido e ainda não recebido: ${brl(d.deferidoNaoRecebido)} (${plural(d.pedidosAReceber, "pedido", "pedidos")})`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`Pedidos em andamento: ${emAndamento}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`Contratos com prazo nos próximos 90 dias: ${d.vencem.length}`, { tam: 11, negrito: true, espaco: 12 });

  pdf.titulo("O que vence nos próximos 90 dias", 12);
  if (!d.vencem.length) pdf.texto("Nenhum prazo nos próximos 90 dias.", { cor: COR.grafite, espaco: 8 });
  else {
    pdf.tabela(
      ["Contrato", "Órgão", "Próximo prazo", "Cada 1% de reajuste (estimativa)"],
      d.vencem.slice(0, LIMITE_CONTRATOS).map((v) => [
        v.numero,
        v.orgao,
        `${data(v.prazo.data)}: ${v.prazo.titulo}`,
        v.referencia ? `${brl(v.referencia.umPorCento)} por mês\n(${origemDoValor(v.referencia)}: ${brl(v.referencia.valor)})` : "valor não informado",
      ]),
      [0.13, 0.27, 0.32, 0.28],
      ["e", "e", "e", "d"],
      8,
    );
    if (d.vencem.length > LIMITE_CONTRATOS) pdf.texto(`E mais ${d.vencem.length - LIMITE_CONTRATOS} contratos; a lista completa está em Hoje e na Carteira.`, { tam: 8, cor: COR.grafite });
  }

  pdf.titulo("Pedidos em andamento", 12);
  if (!d.porSituacao.length) pdf.texto("Nenhum pedido em andamento.", { cor: COR.grafite, espaco: 8 });
  else
    pdf.tabela(
      ["Situação", "Pedidos", "Diferença mensal pedida", "Retroativo pedido"],
      d.porSituacao.map((s) => [NOME_ESTADO[s.estado], String(s.quantidade), brl(s.diferencaMensal), brl(s.retroativo)]),
      [0.37, 0.13, 0.25, 0.25],
      ["e", "d", "d", "d"],
      8.5,
    );

  pdf.texto(
    "Estimativa, não promessa: \"cada 1% de reajuste\" é o valor mensal atual do contrato × 1% (valor mensal cadastrado; sem ele, o último valor registrado; sem os dois, o valor global ÷ meses de vigência). O reajuste real depende da convenção, da planilha de custos e da decisão do órgão. Os demais números são os registrados no sistema; o deferido não recebido é o mesmo saldo da tela A receber.",
    { tam: 7.5, cor: COR.grafite },
  );
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// Relatório do ano
// ---------------------------------------------------------------------------

export async function pedidosParaRelatorio(ctx: Contexto): Promise<PedidoDoAno[]> {
  return db.pedido.findMany({
    where: escopoConta(ctx),
    select: {
      contrato: { select: { id: true, numero: true, orgao: true } },
      geradoEm: true,
      diferencaMensal: true,
      diferencaRetroativa: true,
      deferidoEm: true,
      retroativoAprovado: true,
      valorDeferido: true,
      mensalAprovado: true,
      mensalVigenteAnterior: true,
      recebidoEm: true,
      valorRecebido: true,
      notasFiscais: { select: { id: true, valor: true, emitidaEm: true, canceladaEm: true } },
      baixas: { select: { notaFiscalId: true, valor: true, recebidoEm: true, canceladaEm: true } },
    },
  });
}

export async function relatorioAnoPdf(ctx: Contexto, ano: number) {
  const r = relatorioDoAno(await pedidosParaRelatorio(ctx), ano);
  const { pdf } = await pdfDaConta(ctx, `Relatório de ${ano} · gerado em ${dataLocal(new Date())}`);
  pdf.titulo(`Relatório do ano de ${ano}`, 18);
  pdf.texto(nomeDaVisao(ctx), { cor: COR.grafite, espaco: 10 });
  pdf.texto(`${plural(r.total.montados, "pedido montado", "pedidos montados")} · ${plural(r.total.deferidos, "pedido deferido", "pedidos deferidos")}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`Faturado: ${brl(r.total.faturado)} · Recebido: ${brl(r.total.recebido)}`, { tam: 11, negrito: true, espaco: 12 });
  if (!r.linhas.length) pdf.texto(`Nenhum movimento registrado em ${ano}.`, { cor: COR.grafite });
  else
    pdf.tabela(
      ["Contrato", "Montados", "Mensal pedido", "Retroativo pedido", "Mensal deferido", "Retroativo deferido", "Faturado", "Recebido"],
      [
        ...r.linhas.map((l) => [`${l.numero}\n${l.orgao}`, String(l.montados), brl(l.mensalPedido), brl(l.retroativoPedido), brl(l.mensalDeferido), brl(l.retroativoDeferido), brl(l.faturado), brl(l.recebido)]),
        ["Total", String(r.total.montados), brl(r.total.mensalPedido), brl(r.total.retroativoPedido), brl(r.total.mensalDeferido), brl(r.total.retroativoDeferido), brl(r.total.faturado), brl(r.total.recebido)],
      ],
      [0.2, 0.08, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
      ["e", "d", "d", "d", "d", "d", "d", "d"],
      7.5,
    );
  pdf.texto(
    `Como ler: montados = pedidos gerados em ${ano}, com a diferença mensal e o retroativo que pediram; deferidos = respostas do órgão em ${ano} (aumento mensal aprovado e retroativo aprovado); faturado = notas fiscais emitidas em ${ano}; recebido = recebimentos registrados em ${ano}. Lançamentos cancelados não entram. Diferença mensal e retroativo ficam em colunas separadas e não se somam.`,
    { tam: 7.5, cor: COR.grafite },
  );
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// Caso pronto
// ---------------------------------------------------------------------------

export async function dadosCasoPronto(ctx: Contexto, pedidoId: string) {
  const p = await pedidoDaConta(ctx, pedidoId);
  if (p.estado !== "RECEBIDO") throw new ErroUsuario("O caso fica pronto quando o pedido é recebido.");
  const [notas, baixas] = await Promise.all([
    db.notaFiscalPedido.findMany({ where: { pedidoId: p.id }, select: { id: true, valor: true, canceladaEm: true } }),
    db.baixaPedido.findMany({ where: { pedidoId: p.id }, select: { notaFiscalId: true, valor: true, canceladaEm: true } }),
  ]);
  const recebido = baixas.length ? resumoFinanceiro(p.retroativoAprovado ?? p.valorDeferido ?? 0, notas, baixas).recebido : (p.valorRecebido?.toString() ?? "0.00");
  return {
    p,
    dados: {
      contrato: { numero: p.contrato.numero, orgao: p.contrato.orgao, esfera: p.contrato.esfera, uf: p.contrato.uf, objeto: p.contrato.objeto },
      categoria: p.convencao?.categoria ?? p.contrato.convencao?.categoria ?? null,
      protocoloData: p.protocoloData,
      deferidoEm: p.deferidoEm,
      recebidoEm: p.recebidoEm,
      recebido,
      diferencaMensalPedida: p.diferencaMensal,
      mensalAprovado: p.mensalAprovado,
      mensalVigenteAnterior: p.mensalVigenteAnterior,
      retroativoAprovado: p.retroativoAprovado ?? p.valorDeferido,
    },
  };
}

export async function casoProntoPdf(ctx: Contexto, pedidoId: string, identificado: boolean) {
  const { dados } = await dadosCasoPronto(ctx, pedidoId);
  const { markdown } = textoCasoPronto(dados, { identificado });
  const { pdf } = await pdfDaConta(ctx, `Caso pronto · rascunho para aprovação do cliente · ${dataLocal(new Date())}`);
  pdf.selo("RASCUNHO", COR.carimbo);
  for (const l of markdown.split("\n")) {
    if (l.startsWith("# ")) pdf.titulo(l.slice(2), 16);
    else if (l.startsWith("## ")) pdf.titulo(l.slice(3), 12);
    else if (l === "---") pdf.regua();
    else if (l.startsWith("- ")) pdf.texto(`• ${l.slice(2)}`, { espaco: 2 });
    else if (!l.trim()) pdf.y -= 4;
    else pdf.texto(l, { tam: l.includes("autorização") ? 8 : 10, cor: l.includes("autorização") ? COR.grafite : undefined });
  }
  return pdf.bytes();
}
