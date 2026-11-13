import "server-only";
import ExcelJS from "exceljs";
import { nomeAbaUnico } from "./excel-nomes";
import { aprovacaoValida } from "./pedido-regras";
import JSZip from "jszip";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { db } from "./db";
import { brl, calcularPlanilha, pct, dec } from "./calculo/motor";
import { MODULOS, type PlanilhaCustos } from "./calculo/tipos";
import { calcularPedido, situacaoChecklist, NOME_GATILHO } from "./pedido";
import { formatarCnpj } from "./cnpj";
import { data, dataLocal, dataPorExtenso, hojeUTC } from "./format";
import { COR, hexParaRgb, Pdf } from "./pdf";
import type { ResultadoRaioX } from "./pncp";
import { seloVigencia } from "./prazos";
import { lerArquivo } from "./storage";
import { ErroUsuario } from "./acao";

async function carregar(pedidoId: string, contaId: string) {
  const p = await db.pedido.findFirst({
    where: { id: pedidoId, contrato: { empresa: { contaId } } },
    include: { contrato: { include: { empresa: { include: { conta: true } }, convencao: true } }, convencao: true, documentos: true },
  });
  if (!p) throw new ErroUsuario("Pedido não encontrado.");
  const calc = calcularPedido(p);
  if (!calc.pronto || !calc.comparacao) throw new ErroUsuario("O cálculo ainda tem pendências. Conclua o passo 3.");
  return { p, calc, comp: calc.comparacao };
}

type Dados = Awaited<ReturnType<typeof carregar>>;

function marca(d: Dados) {
  const conta = d.p.contrato.empresa.conta;
  return {
    nome: conta.tipo === "ASSESSORIA" && conta.marcaNome ? conta.marcaNome : "Equapar",
    cor: conta.tipo === "ASSESSORIA" ? hexParaRgb(conta.marcaCor) : null,
    logo: conta.tipo === "ASSESSORIA" ? conta.marcaLogo : null,
  };
}

/** Logo da assessoria para os PDFs (PNG/JPG); sem logo ou com erro de leitura, segue sem ele. */
async function logoDe(caminho: string | null) {
  if (!caminho) return null;
  try {
    const bytes = new Uint8Array(await lerArquivo(caminho));
    return { bytes, tipo: caminho.toLowerCase().endsWith(".png") ? ("png" as const) : ("jpg" as const) };
  } catch {
    return null;
  }
}

function nomeModulo(id: string) {
  return MODULOS.find((m) => m.id === id)?.nome ?? id;
}

// ---------------------------------------------------------------------------
// Ofício (minuta revisável)
// ---------------------------------------------------------------------------

function textoOficio(d: Dados) {
  const { p, comp, calc } = d;
  const c = p.contrato;
  const e = c.empresa;
  const conv = p.convencao ?? c.convencao;
  // L8: data no fuso de Brasília (o servidor pode estar em UTC; entre 21h e 0h sairia o dia seguinte)
  const hoje = hojeUTC();
  const dataExtenso = dataPorExtenso();
  const anexos = situacaoChecklist(p, p.documentos).filter((i) => i.situacao === "ANEXADO").map((i) => i.nome);
  const retro = calc.retroativo;
  return {
    cabecalho: [e.razaoSocial, `CNPJ ${formatarCnpj(e.cnpj)}`],
    linhas: [
      `Ofício nº ____/${hoje.getUTCFullYear()}`,
      `${c.municipio ?? "________"}, ${dataExtenso}.`,
      "",
      `Ao(À) ${c.orgao}`,
      "A/C Gestor(a) e Fiscal do Contrato",
      "",
      `Assunto: Pedido de repactuação do Contrato nº ${c.numero}`,
      "",
      "Senhor(a) Gestor(a),",
      "",
      `${e.razaoSocial}, inscrita no CNPJ sob o nº ${formatarCnpj(e.cnpj)}, contratada por meio do Contrato nº ${c.numero}, cujo objeto é ${c.objeto.replace(/\.$/, "")}, vem, respeitosamente, requerer a REPACTUAÇÃO dos preços contratados, em razão de ${NOME_GATILHO[p.gatilho].toLowerCase()}${conv ? ` (${conv.nome}${conv.registroMte ? `, registro ${conv.registroMte}` : ""}${p.dataDeposito ? `, depositada em ${data(p.dataDeposito)}` : ""})` : ""}${p.descricaoGatilho ? `: ${p.descricaoGatilho}` : ""}, com data-base em ${data(p.dataBase)}.`,
      "",
      `Em atenção ao art. 135, § 6º, da Lei nº 14.133/2021, segue a demonstração analítica da variação dos custos, na planilha de custos e formação de preços e na memória de cálculo anexas, linha a linha, com a indicação da cláusula da convenção que fundamenta cada valor.`,
      "",
      `Conforme a memória de cálculo, o valor mensal do contrato passa de ${brl(comp.mensalAntes)} para ${brl(comp.mensalAgora)}, uma diferença de ${brl(comp.diferencaMensal)} por mês${comp.variacaoPct ? ` (${pct(comp.variacaoPct)})` : ""}.${retro ? ` A diferença acumulada desde a data-base até ${data(calc.dataReferencia)} soma ${brl(retro.total)} (${calc.regraRetroativo}).` : ""}`,
      "",
      "Diante do exposto, requer:",
      `a) a repactuação do valor mensal do contrato para ${brl(comp.mensalAgora)}, com efeitos financeiros a partir de ${data(p.dataBase)};`,
      "b) o apostilamento da repactuação;",
      "c) o pagamento das diferenças retroativas, a serem faturadas em nota fiscal própria após o apostilamento.",
      "",
      "Anexos:",
      ...anexos.map((a, i) => `${i + 1}. ${a}`),
      "",
      "Atenciosamente,",
      "",
      "",
      "______________________________________",
      e.razaoSocial,
      "Representante legal",
    ],
  };
}

export async function oficioDocx(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const t = textoOficio(d);
  const doc = new Document({
    creator: marca(d).nome,
    title: `Pedido de repactuação ${d.p.contrato.numero}`,
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "MINUTA — revise com seu jurídico antes de protocolar", italics: true, color: "B23A1C", size: 18 })],
          }),
          ...t.cabecalho.map((l, i) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, bold: i === 0 })] })),
          new Paragraph({ text: "" }),
          ...t.linhas.map(
            (l) =>
              new Paragraph({
                alignment: l.length > 120 ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
                spacing: { after: 60 },
                children: [new TextRun({ text: l, bold: l.startsWith("Assunto:") })],
              }),
          ),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function oficioPdf(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const t = textoOficio(d);
  const m = marca(d);
  const pdf = await Pdf.criar(`Ofício · Contrato ${d.p.contrato.numero} · minuta gerada por ${m.nome}`, m.cor, await logoDe(m.logo));
  pdf.texto("MINUTA — revise com seu jurídico antes de protocolar", { tam: 8, cor: COR.carimbo });
  for (const [i, l] of t.cabecalho.entries()) pdf.texto(l, { tam: i === 0 ? 12 : 10, negrito: i === 0, espaco: 0 });
  pdf.y -= 14;
  for (const l of t.linhas) {
    if (!l) {
      pdf.y -= 6;
      continue;
    }
    pdf.texto(l, { tam: 10.5, negrito: l.startsWith("Assunto:"), espaco: 2 });
  }
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// Memória de cálculo (PDF)
// ---------------------------------------------------------------------------

export async function memoriaPdf(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const { p, comp, calc } = d;
  const c = p.contrato;
  const conv = p.convencao ?? c.convencao;
  const m = marca(d);
  const pdf = await Pdf.criar(`Memória de cálculo · Contrato ${c.numero} · ${m.nome} · regra ${calc.versaoRegra}`, m.cor, await logoDe(m.logo));
  if (aprovacaoValida(p)) pdf.selo("MEMÓRIA APROVADA", COR.verde);
  pdf.titulo("Memória de cálculo da repactuação");
  pdf.texto(`Contrato ${c.numero} · ${c.orgao}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`${c.empresa.razaoSocial} · CNPJ ${formatarCnpj(c.empresa.cnpj)}`, { cor: COR.grafite, espaco: 2 });
  pdf.texto(
    `Gatilho: ${NOME_GATILHO[p.gatilho]}${conv ? ` · ${conv.nome}` : ""} · data-base ${data(p.dataBase)}${p.dataDeposito ? ` · depósito ${data(p.dataDeposito)}` : ""}`,
    { cor: COR.grafite, espaco: 2 },
  );
  pdf.texto(
    `Estrutura: IN SEGES/MP 05/2017, Anexo VII-D · Regra ${calc.versaoRegra} · arredondamento de cada linha a 2 casas, meio para cima · tributos calculados por dentro.`,
    { tam: 8.5, cor: COR.grafite, espaco: 8 },
  );
  pdf.regua();

  pdf.titulo("Resumo", 12);
  pdf.tabela(
    ["Tipo de posto", "Qtd. antes", "Qtd. agora", "Por posto antes", "Por posto agora", "Mensal antes", "Mensal agora"],
    [
      ...comp.postos.map((x) => [x.nome, String(x.quantidadeAntes), String(x.quantidadeAgora), brl(x.porPostoAntes), brl(x.porPostoAgora), brl(x.mensalAntes), brl(x.mensalAgora)]),
      ["Total", "", "", "", "", brl(comp.mensalAntes), brl(comp.mensalAgora)],
    ],
    [0.22, 0.08, 0.08, 0.155, 0.155, 0.155, 0.155],
    ["e", "d", "d", "d", "d", "d", "d"],
  );
  pdf.texto(`Diferença por mês: ${brl(comp.diferencaMensal)}${comp.variacaoPct ? ` (${pct(comp.variacaoPct)})` : ""}`, { tam: 12, negrito: true });
  if (calc.retroativo) {
    pdf.texto(`Desde a data-base (${data(p.dataBase)}) até ${data(calc.dataReferencia)}: ${brl(calc.retroativo.total)}`, { tam: 12, negrito: true, espaco: 4 });
    pdf.texto(`Regra: diferença ${calc.regraRetroativo}.`, { tam: 9, espaco: 10 });
  }

  for (const posto of comp.postos) {
    pdf.titulo(`Linha a linha · ${posto.nome}`, 12);
    let modAtual = "";
    const linhas: string[][] = [];
    for (const l of comp.linhas.filter((x) => x.postoId === posto.id)) {
      if (l.modulo !== modAtual) {
        modAtual = l.modulo;
        linhas.push([nomeModulo(l.modulo).toUpperCase(), "", "", "", ""]);
      }
      linhas.push([`${l.descricao}${l.fonte ? `\nFonte: ${l.fonte}` : ""}`, brl(l.antes), brl(l.agora), brl(l.variacao), l.contaAgora]);
    }
    linhas.push([`Total por posto`, brl(posto.porPostoAntes), brl(posto.porPostoAgora), brl(dec(posto.porPostoAgora).minus(dec(posto.porPostoAntes))), ""]);
    pdf.tabela(["Item", "Antes", "Agora", "Variação", "Conta (agora)"], linhas, [0.3, 0.12, 0.12, 0.12, 0.34], ["e", "d", "d", "d", "e"]);
  }

  if (calc.retroativo?.meses.length) {
    pdf.titulo("Diferença retroativa, mês a mês", 12);
    pdf.tabela(
      ["Competência", "Dias", "Conta", "Valor"],
      [...calc.retroativo.meses.map((x) => [x.competencia, `${x.dias}/${x.diasNoMes}`, x.conta, brl(x.valor)]), ["Total", "", "", brl(calc.retroativo.total)]],
      [0.18, 0.12, 0.5, 0.2],
      ["e", "d", "e", "d"],
    );
  }

  pdf.regua();
  pdf.texto(
    aprovacaoValida(p) ? `Memória aprovada por ${p.memoriaAprovadaPor} em ${dataLocal(p.memoriaAprovadaEm!)}.` : "Memória ainda não aprovada por Contador ou Dono.",
    { tam: 9, cor: aprovacaoValida(p) ? COR.verde : COR.carimbo },
  );
  pdf.texto(
    "Os números vêm da planilha da proposta e da convenção informadas pelo usuário. A Equapar aplica a estrutura de cálculo; a revisão por profissional habilitado é recomendada antes do protocolo.",
    { tam: 8, cor: COR.grafite },
  );
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// Planilha (Excel)
// ---------------------------------------------------------------------------

export async function planilhaXlsx(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const { p, comp, calc } = d;
  const wb = new ExcelJS.Workbook();
  wb.creator = marca(d).nome;
  const moeda = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  // C4: nomes de aba únicos (postos com nomes parecidos não colidem mais)
  const usados = new Set(["comparativo", "retroativo"]);

  for (const [rotulo, planilha] of [
    ["Planilha nova", p.planilhaAgora],
    ["Planilha atual", p.planilhaAntes],
  ] as const) {
    const r = calcularPlanilha(planilha as unknown as PlanilhaCustos);
    for (const posto of r.postos) {
      const ws = wb.addWorksheet(nomeAbaUnico(`${rotulo} - ${posto.nome}`, usados));
      ws.columns = [{ width: 52 }, { width: 18 }, { width: 70 }, { width: 40 }];
      ws.addRow([`${rotulo} · ${posto.nome} · ${posto.quantidade} posto(s)`]).font = { bold: true, size: 13 };
      ws.addRow([`Contrato ${p.contrato.numero} · ${p.contrato.orgao}`]);
      ws.addRow([]);
      const cab = ws.addRow(["Item", "Valor por posto", "Conta", "Fonte"]);
      cab.font = { bold: true };
      let mod = "";
      for (const l of posto.linhas) {
        if (l.modulo !== mod) {
          mod = l.modulo;
          const t = ws.addRow([nomeModulo(mod)]);
          t.font = { bold: true, color: { argb: "FF1E7A55" } };
        }
        const row = ws.addRow([l.descricao, Number(l.valor), l.conta, l.fonte ?? ""]);
        row.getCell(2).numFmt = moeda;
      }
      ws.addRow([]);
      const tp = ws.addRow(["Valor por posto", Number(posto.valorPorPosto)]);
      tp.font = { bold: true };
      tp.getCell(2).numFmt = moeda;
      const tm = ws.addRow([`Valor mensal (${posto.quantidade} posto(s))`, Number(posto.valorMensal)]);
      tm.font = { bold: true };
      tm.getCell(2).numFmt = moeda;
    }
  }

  const ws = wb.addWorksheet("Comparativo");
  ws.columns = [{ width: 22 }, { width: 46 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 40 }];
  ws.addRow(["Tipo de posto", "Item", "Antes", "Agora", "Variação", "Variação %", "Fonte"]).font = { bold: true };
  for (const l of comp.linhas) {
    const row = ws.addRow([l.postoNome, l.descricao, Number(l.antes), Number(l.agora), Number(l.variacao), l.variacaoPct ? Number(l.variacaoPct) / 100 : null, l.fonte ?? ""]);
    [3, 4, 5].forEach((i) => (row.getCell(i).numFmt = moeda));
    row.getCell(6).numFmt = "0.00%";
  }
  ws.addRow([]);
  for (const [k, v] of [
    ["Valor mensal antes", comp.mensalAntes],
    ["Valor mensal agora", comp.mensalAgora],
    ["Diferença por mês", comp.diferencaMensal],
    ...(calc.retroativo ? [[`Diferença desde a data-base até ${data(calc.dataReferencia)}`, calc.retroativo.total]] : []),
  ]) {
    const row = ws.addRow(["", k, Number(v)]);
    row.font = { bold: true };
    row.getCell(3).numFmt = moeda;
  }

  if (calc.retroativo) {
    const wr = wb.addWorksheet("Retroativo");
    wr.columns = [{ width: 14 }, { width: 10 }, { width: 50 }, { width: 16 }];
    wr.addRow(["Competência", "Dias", "Conta", "Valor"]).font = { bold: true };
    for (const mm of calc.retroativo.meses) {
      const row = wr.addRow([mm.competencia, `${mm.dias}/${mm.diasNoMes}`, mm.conta, Number(mm.valor)]);
      row.getCell(4).numFmt = moeda;
    }
    const t = wr.addRow(["Total", "", "", Number(calc.retroativo.total)]);
    t.font = { bold: true };
    t.getCell(4).numFmt = moeda;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Pacote ZIP
// ---------------------------------------------------------------------------

export async function pacoteZip(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const n = d.p.contrato.numero.replace(/[^\w.-]+/g, "-");
  const zip = new JSZip();
  zip.file(`01-oficio-contrato-${n}.docx`, await oficioDocx(pedidoId, contaId));
  zip.file(`01-oficio-contrato-${n}.pdf`, await oficioPdf(pedidoId, contaId));
  zip.file(`02-planilha-contrato-${n}.xlsx`, await planilhaXlsx(pedidoId, contaId));
  zip.file(`03-memoria-de-calculo-contrato-${n}.pdf`, await memoriaPdf(pedidoId, contaId));
  const docs = [...d.p.documentos];
  let i = 4;
  for (const doc of docs) {
    try {
      zip.file(`${String(i++).padStart(2, "0")}-anexo-${doc.nome}`, await lerArquivo(doc.caminho));
    } catch {
      /* arquivo removido do disco: segue sem ele */
    }
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------------
// Relatório do Raio-X
// ---------------------------------------------------------------------------

export async function raioXPdf(r: ResultadoRaioX) {
  const pdf = await Pdf.criar(`Raio-X Equapar · dados públicos do PNCP consultados em ${dataLocal(r.consultadoEm)}`);
  pdf.titulo("Raio-X dos contratos públicos", 20);
  pdf.texto(`${r.razaoSocial ?? "Empresa"} · CNPJ ${formatarCnpj(r.cnpj)}`, { tam: 12, negrito: true, espaco: 2 });
  const seis = r.contratos.filter((c) => {
    const s = seloVigencia(c.fim);
    return s.tom !== "neutro";
  }).length;
  pdf.texto(`${r.contratos.length} contratos vigentes no PNCP. ${seis} terminam nos próximos 6 meses.`, { espaco: 10 });
  pdf.tabela(
    ["Órgão", "Objeto", "Fim da vigência", "Prazo"],
    r.contratos.map((c) => [c.orgao, c.objeto.slice(0, 160), data(c.fim), seloVigencia(c.fim).texto]),
    [0.27, 0.43, 0.13, 0.17],
  );
  pdf.titulo("O que fazer agora", 12);
  for (const t of [
    "Confira se a convenção coletiva deste ano já foi depositada.",
    "Separe a planilha de custos da proposta.",
    "Antes de assinar a prorrogação, peça a repactuação ou registre a ressalva.",
  ])
    pdf.texto(`• ${t}`);
  pdf.y -= 6;
  pdf.texto(
    "Este relatório usa só dados públicos do Portal Nacional de Contratações Públicas (PNCP). Ele não estima valor a recuperar: isso depende da planilha de custos e da convenção, que o CNPJ não revela. Contratos antigos podem não ter sido publicados no PNCP.",
    { tam: 8, cor: COR.grafite },
  );
  return pdf.bytes();
}
