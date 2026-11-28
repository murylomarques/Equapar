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
import { data, dataLocal, dataPorExtenso, diasAte, hojeUTC, plural, reais } from "./format";
import { tempoAteFim } from "./mascaras";
import { COR, hexParaRgb, Pdf } from "./pdf";
import type { ResultadoRaioX } from "./pncp";
import { comUmPorCento } from "./raio-x-valor";
import { seloVigencia } from "./prazos";
import { lerArquivo } from "./storage";
import { ErroUsuario } from "./acao";
import {
  explicarInicio,
  JORNADA,
  METODOLOGIA_JORNADA_VERSAO,
  NOME_CENARIO,
  NOME_ENQUADRAMENTO,
  NORMAS_JORNADA,
  horasReduzidas,
  planilhaDoCenario,
  prazoAditivoDoContrato,
  reducaoHorasPct,
  type Cenario,
  type Enquadramento,
} from "./jornada";
import { jornadaEmSimulacao, MARCA_SIMULACAO_JORNADA } from "./jornada-acesso";
import { validarDocumentoFinal } from "./pedido-final";

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

/** D0: documento da jornada enquanto a chave mestra estiver desligada (só PAINEL_EMAILS chegam aqui). */
function simulacaoJornada(d: Dados) {
  return d.p.gatilho === "JORNADA_EC141" && jornadaEmSimulacao();
}

function marca(d: Dados) {
  return marcaDaConta(d.p.contrato.empresa.conta);
}

/** Nome, cor e logo dos PDFs: os da assessoria (conta ASSESSORIA com marca) ou "Equapar". */
export function marcaDaConta(conta: { tipo: string; marcaNome: string | null; marcaCor: string | null; marcaLogo: string | null }) {
  return {
    nome: conta.tipo === "ASSESSORIA" && conta.marcaNome ? conta.marcaNome : "Equapar",
    cor: conta.tipo === "ASSESSORIA" ? hexParaRgb(conta.marcaCor) : null,
    logo: conta.tipo === "ASSESSORIA" ? conta.marcaLogo : null,
  };
}

/** Logo da assessoria para os PDFs (PNG/JPG); sem logo ou com erro de leitura, segue sem ele. */
export async function logoDe(caminho: string | null) {
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
  const jornada = p.gatilho === "JORNADA_EC141";
  return {
    cabecalho: [e.razaoSocial, `CNPJ ${formatarCnpj(e.cnpj)}`],
    linhas: [
      `Ofício nº ____/${hoje.getUTCFullYear()}`,
      `${c.municipio ?? "________"}, ${dataExtenso}.`,
      "",
      `Ao(À) ${c.orgao}`,
      "A/C Gestor(a) e Fiscal do Contrato",
      "",
      jornada ? `Assunto: Pedido de adequação do Contrato nº ${c.numero} à jornada da EC 141/2026 (termo aditivo)` : `Assunto: Pedido de repactuação do Contrato nº ${c.numero}`,
      "",
      "Senhor(a) Gestor(a),",
      "",
      ...(jornada ? linhasJornada(d) : []),
      ...(jornada
        ? []
        : [`${e.razaoSocial}, inscrita no CNPJ sob o nº ${formatarCnpj(e.cnpj)}, contratada por meio do Contrato nº ${c.numero}, cujo objeto é ${c.objeto.replace(/\.$/, "")}, vem, respeitosamente, requerer a REPACTUAÇÃO dos preços contratados, em razão de ${NOME_GATILHO[p.gatilho].toLowerCase()}${conv ? ` (${conv.nome}${conv.registroMte ? `, registro ${conv.registroMte}` : ""}${p.dataDeposito ? `, depositada em ${data(p.dataDeposito)}` : ""})` : ""}${p.descricaoGatilho ? `: ${p.descricaoGatilho}` : ""}, com data-base em ${data(p.dataBase)}.`,
      "",
      `Em atenção ao art. 135, § 6º, da Lei nº 14.133/2021, segue a demonstração analítica da variação dos custos, na planilha de custos e formação de preços e na memória de cálculo anexas, linha a linha, com a indicação da cláusula da convenção que fundamenta cada valor.`,
      "",
      `Conforme a memória de cálculo, o valor mensal do contrato passa de ${brl(comp.mensalAntes)} para ${brl(comp.mensalAgora)}, uma diferença de ${brl(comp.diferencaMensal)} por mês${comp.variacaoPct ? ` (${pct(comp.variacaoPct)})` : ""}.${retro ? ` A diferença acumulada desde a data-base até ${data(calc.dataReferencia)} soma ${brl(retro.total)} (${calc.regraRetroativo}).` : ""}`,
      "",
      "Diante do exposto, requer:",
      `a) a repactuação do valor mensal do contrato para ${brl(comp.mensalAgora)}, com efeitos financeiros a partir de ${data(p.dataBase)};`,
      "b) o apostilamento da repactuação;",
      "c) o pagamento das diferenças retroativas, a serem faturadas em nota fiscal própria após o apostilamento.",
          ]),
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

// Pedido da jornada: fundamento do parecer de 28/11/2026 (art. 9º da EC 141/2026; arts. 124 e 134 da Lei 14.133/2021).

/** D5: as duas opções, com a preferência da empresa marcada. Calculadas da mesma planilha atual. */
/** Parecer de 28/11/2026 (A4): os três cenários lado a lado, com o valor de cada um. */
function cenariosLadoALado(d: Dados): string[] {
  const { p } = d;
  const atual = p.planilhaAntes as unknown as PlanilhaCustos;
  const a = p.jornadaAntes!;
  const b = p.jornadaDepois!;
  const cob = Number(p.horasCobertura);
  const valor = (c: Cenario) => calcularPedido({ ...p, planilhaAgora: planilhaDoCenario(atual, c, a, b) as never }).comparacao;
  const pref = (c: string) => (p.cenarioJornada === c ? " [opção apresentada pela empresa]" : "");
  const manter = valor("MANTER_HORAS");
  const reorganizar = atual.tipos.every((t) => t.jornada?.empregadosAntes && t.jornada?.empregadosDepois) ? valor("REORGANIZAR_ESCALAS") : null;
  return [
    `(1) ${NOME_CENARIO.MANTER_HORAS}${pref("MANTER_HORAS")}: ${cob} horas semanais por posto, com o redimensionamento de empregados, escalas e substituições; valor mensal ${manter ? brl(manter.mensalAgora) : "—"} (diferença de ${manter ? brl(manter.diferencaMensal) : "—"}).`,
    `(2) ${NOME_CENARIO.REDUZIR_HORAS}${pref("REDUZIR_HORAS")}: proposta de ${horasReduzidas(cob, a, b).toString().replace(".", ",")} horas semanais por posto (redução de ${reducaoHorasPct(a, b).toFixed(3).replace(".", ",")}%), a negociar; a manutenção do preço mensal não é garantida.`,
    `(3) ${NOME_CENARIO.REORGANIZAR_ESCALAS}${pref("REORGANIZAR_ESCALAS")}: ${reorganizar ? `escalas e número de empregados informados pela empresa em cada posto; valor mensal ${brl(reorganizar.mensalAgora)} (diferença de ${brl(reorganizar.diferencaMensal)}).` : "alternativa a apresentar com o dimensionamento de cada posto."}`,
  ];
}

/** Datas do pedido da jornada, separadas (A2). */
function datasJornada(p: Dados["p"]): string[] {
  const enq = p.jornadaEnquadramento as Enquadramento | null;
  const prazo = enq ? prazoAditivoDoContrato(enq, p.jornadaAssinaturaContrato) : null;
  return [
    `Exigibilidade geral da jornada da etapa: ${data(p.inicioJornada)}.`,
    `Enquadramento do contrato: ${enq ? NOME_ENQUADRAMENTO[enq] : "não informado"}${prazo ? `; prazo para o termo aditivo: ${data(prazo)}` : ""}.`,
    ...(p.jornadaAlteracaoCustos ? [`Alteração efetiva dos custos: ${data(p.jornadaAlteracaoCustos)}.`] : []),
    ...(p.protocoloData ? [`Protocolo do pedido: ${data(p.protocoloData)}.`] : []),
    ...(p.jornadaDataAditivo ? [`Formalização do aditivo: ${data(p.jornadaDataAditivo)}.`] : []),
    `Efeitos financeiros pleiteados a partir de: ${data(p.jornadaInicioEfeitos ?? p.dataBase)}.`,
    ...(p.jornadaEfeitosReconhecidos ? [`Efeitos financeiros reconhecidos pela Administração a partir de: ${data(p.jornadaEfeitosReconhecidos)}.`] : []),
  ];
}

function linhasJornada(d: Dados): string[] {
  const { p, comp, calc } = d;
  const c = p.contrato;
  const e = c.empresa;
  const cen = (p.cenarioJornada ?? "MANTER_HORAS") as Cenario;
  const retro = calc.retroativo;
  const efeitos = p.jornadaInicioEfeitos ?? p.dataBase;
  const dif = Number(comp.diferencaMensal);
  return [
    `${e.razaoSocial}, inscrita no CNPJ sob o nº ${formatarCnpj(e.cnpj)}, contratada por meio do Contrato nº ${c.numero}, cujo objeto é ${c.objeto.replace(/\.$/, "")}, vem, respeitosamente, requerer a ADEQUAÇÃO CONTRATUAL à redução da duração do trabalho de ${p.jornadaAntes} para ${p.jornadaDepois} horas semanais, decorrente da Emenda Constitucional nº 141/2026, por meio de termo aditivo, com fundamento no art. 9º da EC 141/2026 e nos arts. 124 e 134 da Lei 14.133/2021.`,
    "",
    "Trata-se de recomposição decorrente de alteração legislativa, distinta da repactuação ordinária prevista no contrato: não se aplica a exigência de anualidade, e a formalização se dá por termo aditivo, não por apostilamento.",
    "",
    "Datas consideradas:",
    ...datasJornada(p),
    "",
    "Os cenários possíveis, lado a lado:",
    ...cenariosLadoALado(d),
    "A escolha do cenário e a formalização cabem ao órgão, pelo rito do contrato.",
    "",
    cen === "REDUZIR_HORAS"
      ? `Na opção apresentada pela empresa (reduzir as horas de cobertura), as horas de serviço de cada posto passariam de ${Number(p.horasCobertura)} para ${horasReduzidas(Number(p.horasCobertura), p.jornadaAntes!, p.jornadaDepois!).toString().replace(".", ",")} horas semanais. Trata-se de proposta de alteração das condições de execução, a negociar, com os impactos demonstrados na planilha comparativa.`
      : `Na opção apresentada pela empresa (${NOME_CENARIO[cen].toLowerCase()}), o cálculo foi feito por tipo de posto, com o dimensionamento real de pessoal informado pela empresa; os fatores ${p.jornadaAntes}/${p.jornadaDepois} servem só como referência matemática. O salário mensal fica preservado e o segundo repouso semanal não é somado de novo. A planilha comparativa e a memória de cálculo anexas demonstram cada rubrica alterada. O valor mensal do contrato passa de ${brl(comp.mensalAntes)} para ${brl(comp.mensalAgora)}, ${dif > 0 ? "um acréscimo" : dif < 0 ? "uma redução" : "sem variação"}${dif !== 0 ? ` de ${brl(Math.abs(dif).toFixed(2))} por mês` : ""}${comp.variacaoPct && dif !== 0 ? ` (${pct(comp.variacaoPct)})` : ""}.${retro && dif > 0 ? ` A diferença por competência desde ${data(efeitos)} até ${data(calc.dataReferencia)} soma ${brl(retro.total)} (demonstrativo anexo), sujeita à comprovação da repercussão econômica.` : ""}`,
    "",
    "Diante do exposto, requer:",
    cen === "REDUZIR_HORAS"
      ? "a) a celebração de termo aditivo que formalize a adequação das condições de execução à nova jornada;"
      : `a) a celebração de termo aditivo de adequação, com o valor mensal do contrato em ${brl(comp.mensalAgora)}, com efeitos a partir de ${data(efeitos)};`,
    cen === "REDUZIR_HORAS"
      ? "b) a adequação das ordens de serviço à nova carga horária."
      : "b) o pagamento das diferenças apuradas por competência, comprovada a repercussão econômica, em nota fiscal própria após o aditivo.",
  ];
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
            children: [
              ...(simulacaoJornada(d) ? [new TextRun({ text: `${MARCA_SIMULACAO_JORNADA} `, bold: true, color: "B23A1C", size: 22 })] : []),
              new TextRun({ text: "MINUTA — revise com seu jurídico antes de protocolar", italics: true, color: "B23A1C", size: 18 }),
            ],
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
  if (simulacaoJornada(d)) pdf.selo(MARCA_SIMULACAO_JORNADA, COR.carimbo);
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
  if (simulacaoJornada(d)) pdf.selo(MARCA_SIMULACAO_JORNADA, COR.carimbo);
  pdf.titulo(p.gatilho === "JORNADA_EC141" ? "Memória de cálculo da adequação à jornada" : "Memória de cálculo da repactuação");
  pdf.texto(`Contrato ${c.numero} · ${c.orgao}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`${c.empresa.razaoSocial} · CNPJ ${formatarCnpj(c.empresa.cnpj)}`, { cor: COR.grafite, espaco: 2 });
  pdf.texto(
    `Gatilho: ${NOME_GATILHO[p.gatilho]}${conv ? ` · ${conv.nome}` : ""} · data-base ${data(p.dataBase)}${p.dataDeposito ? ` · depósito ${data(p.dataDeposito)}` : ""}`,
    { cor: COR.grafite, espaco: 2 },
  );
  if (p.gatilho === "JORNADA_EC141")
    pdf.texto(
      `Jornada de ${p.jornadaAntes} para ${p.jornadaDepois} horas semanais · cobertura de ${Number(p.horasCobertura)} horas por posto · cenário: ${NOME_CENARIO[(p.cenarioJornada ?? "MANTER_HORAS") as Cenario].toLowerCase()} · cálculo por tipo de posto, com o dimensionamento informado pela empresa · metodologia ${p.metodologiaVersao ?? METODOLOGIA_JORNADA_VERSAO}. A diferença pode ser positiva, negativa ou zero.`,
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
    pdf.texto(`Regra: diferença ${calc.regraRetroativo}.`, { tam: 9, espaco: calc.jaPago || calc.comparacaoMes || p.ultimaCompetenciaPaga ? 2 : 10 });
    // C6: valores já pagos, última competência paga e a regra do caso em análise
    if (calc.jaPago) pdf.texto(`Retroativo bruto ${brl(calc.retroativoBruto!)}, menos ${brl(calc.jaPago)} já pagos pelo órgão no período.`, { tam: 9, espaco: 2 });
    if (p.ultimaCompetenciaPaga) pdf.texto(`Última competência paga pelo valor anterior: ${p.ultimaCompetenciaPaga}.`, { tam: 9, espaco: 2 });
    if (calc.comparacaoMes)
      pdf.texto(`Regra do caso em análise (mês incompleto): dias corridos ${brl(calc.comparacaoMes.DIAS_CORRIDOS)}; mês de 30 dias ${brl(calc.comparacaoMes.MES_30_DIAS)}. O pedido usa ${p.retroMesIncompleto === "MES_30_DIAS" ? "o mês de 30 dias" : "os dias corridos"}.`, { tam: 9, espaco: 10 });
  }

  // evidência de cada linha alterada, com o que foi DECLARADO sobre a anualidade (nada é dito como validado se não foi)
  const evidencia = new Map(((p.planilhaAgora as unknown as PlanilhaCustos | null)?.tipos ?? []).flatMap((t) => t.linhas.map((l) => [`${t.id}:${l.id}`, l.evidencia] as const)));
  const textoEvidencia = (postoId: string, linhaId: string) => {
    const e = evidencia.get(`${postoId}:${linhaId}`);
    if (!e) return "";
    const fonte = [e.instrumento, e.categoria && `categoria ${e.categoria}`, e.clausula, e.dataBase && `data-base ${data(new Date(`${e.dataBase}T00:00:00Z`))}`].filter(Boolean).join(", ");
    const anual =
      e.anualidade === "VALIDA"
        ? "anualidade declarada pela empresa (um ano ou mais desde a data-base anterior)"
        : e.anualidade === "NAO_SE_APLICA"
          ? `anualidade não se aplica: ${e.motivoRevisao ?? ""}`
          : e.anualidade === "REVISAO_RESOLVIDA"
            ? `anualidade revista: ${e.motivoRevisao ?? ""}`
            : e.anualidade === "REVISAO_NECESSARIA"
              ? "anualidade em revisão"
              : "anualidade não respondida";
    return `\nEvidência: ${fonte}; ${anual}`;
  };

  for (const posto of comp.postos) {
    pdf.titulo(`Linha a linha · ${posto.nome}`, 12);
    let modAtual = "";
    const linhas: string[][] = [];
    for (const l of comp.linhas.filter((x) => x.postoId === posto.id)) {
      if (l.modulo !== modAtual) {
        modAtual = l.modulo;
        linhas.push([nomeModulo(l.modulo).toUpperCase(), "", "", "", ""]);
      }
      linhas.push([`${l.descricao}${l.fonte ? `\nFonte: ${l.fonte}` : ""}${l.antes !== l.agora ? textoEvidencia(l.postoId, l.id) : ""}`, brl(l.antes), brl(l.agora), brl(l.variacao), l.contaAgora]);
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

export async function pacoteZip(pedidoId: string, contaId: string, opcoes: { rascunho?: boolean } = {}) {
  const d = await carregar(pedidoId, contaId);
  if (!opcoes.rascunho) await validarDocumentoFinal(d.p);
  const n = d.p.contrato.numero.replace(/[^\w.-]+/g, "-");
  const zip = new JSZip();
  zip.file(`01-oficio-contrato-${n}.docx`, await oficioDocx(pedidoId, contaId));
  zip.file(`01-oficio-contrato-${n}.pdf`, await oficioPdf(pedidoId, contaId));
  zip.file(`02-planilha-contrato-${n}.xlsx`, await planilhaXlsx(pedidoId, contaId));
  zip.file(`03-memoria-de-calculo-contrato-${n}.pdf`, await memoriaPdf(pedidoId, contaId));
  const docs = [...d.p.documentos];
  let i = 4;
  // parecer de 28/11/2026 (A5): os 7 documentos da jornada (requerimento, fundamentação, memória, planilha, retroativo, minuta, anexos)
  if (d.p.gatilho === "JORNADA_EC141") {
    zip.file(`${String(i++).padStart(2, "0")}-fundamentacao-normativa-contrato-${n}.pdf`, await fundamentacaoPdf(pedidoId, contaId));
    zip.file(`${String(i++).padStart(2, "0")}-demonstrativo-retroativo-contrato-${n}.pdf`, await retroativoPdf(pedidoId, contaId));
    zip.file(`${String(i++).padStart(2, "0")}-minuta-aditivo-contrato-${n}.pdf`, await minutaAditivoPdf(pedidoId, contaId));
  }
  for (const doc of docs) {
    try {
      zip.file(`${String(i++).padStart(2, "0")}-anexo-${doc.nome}`, await lerArquivo(doc.caminho));
    } catch {
      throw new ErroUsuario(`O anexo ${doc.nome} não foi encontrado no armazenamento. Reenvie o arquivo antes de gerar o pacote.`);
    }
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------------
// Parecer de 28/11/2026 (A5): fundamentação normativa e demonstrativo retroativo do pedido da jornada
// ---------------------------------------------------------------------------

export async function fundamentacaoPdf(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const { p } = d;
  if (p.gatilho !== "JORNADA_EC141") throw new ErroUsuario("A fundamentação normativa é do pedido da jornada.");
  const c = p.contrato;
  const m = marca(d);
  const enq = p.jornadaEnquadramento as Enquadramento | null;
  const pdf = await Pdf.criar(`Fundamentação normativa · Contrato ${c.numero} · ${m.nome}`, m.cor, await logoDe(m.logo));
  if (simulacaoJornada(d)) pdf.selo(MARCA_SIMULACAO_JORNADA, COR.carimbo);
  pdf.titulo("Fundamentação normativa");
  pdf.texto(`Contrato ${c.numero} · ${c.orgao} · ${c.empresa.razaoSocial}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(`Metodologia ${p.metodologiaVersao ?? METODOLOGIA_JORNADA_VERSAO} · normas consultadas até 28/11/2026.`, { tam: 9, cor: COR.grafite, espaco: 8 });
  pdf.titulo("Normas aplicáveis", 12);
  for (const n of NORMAS_JORNADA) pdf.texto(`• ${n.nome}`, { tam: 10, espaco: 2 });
  pdf.texto(
    `A medida cautelar do STF tem natureza provisória${JORNADA.liminarVigente() ? " e está considerada nesta data" : " e não está sendo aplicada nesta data"}; os prazos podem mudar com o julgamento.`,
    { tam: 9, cor: COR.grafite, espaco: 8 },
  );
  pdf.titulo("Enquadramento e prazos", 12);
  pdf.texto(enq ? NOME_ENQUADRAMENTO[enq] + "." : "Enquadramento não informado.", { tam: 10, espaco: 2 });
  if (enq) pdf.texto(explicarInicio(p.jornadaDepois === 40 ? "42-40" : "44-42", enq, { dataAditivo: p.jornadaDataAditivo, assinatura: p.jornadaAssinaturaContrato }), { tam: 10, espaco: 4 });
  for (const l of datasJornada(p)) pdf.texto(`• ${l}`, { tam: 10, espaco: 2 });
  pdf.texto(
    "A data de aplicação da jornada não se confunde com o reconhecimento administrativo dos efeitos financeiros, que depende da decisão do órgão.",
    { tam: 9, cor: COR.grafite, espaco: 8 },
  );
  pdf.titulo("Regras de cálculo aplicadas", 12);
  for (const l of [
    "Cálculo individualizado por contrato, tipo de posto e jornada; os fatores 44/42 e 44/40 são referência matemática, não teto legal nem aumento automático.",
    "Postos de 42 horas ou menos não se alteram na etapa de 42 horas; de 40 horas ou menos, em nenhuma etapa. Na escala 12x36, a média mensal acima do limite semanal gera horas extras ou compensação, conforme o instrumento coletivo (Decreto 13.173/2026).",
    "Divisores mensais de referência do salário-hora: 220 (44 h), 210 (42 h) e 200 (40 h), preservado o divisor mais favorável ao trabalhador.",
    "Salário mensal e piso preservados; encargos recalculados sobre a base efetivamente alterada; vale-transporte e alimentação pelos dias trabalhados ou pelo valor fixado no instrumento coletivo.",
    "O segundo repouso semanal remunerado vale desde 16/12/2026 e é tratado à parte; o valor já incorporado ao salário mensal não é duplicado (Portaria MTE 2.041/2026, art. 11).",
    "Diferença = novo custo contratual − custo vigente, rubrica por rubrica, sem dupla contagem; pode ser positiva, negativa ou zero, e não presume crédito contra o órgão.",
    "Recomposição por alteração legislativa: distinta da repactuação ordinária (art. 136 da Lei 14.133/2021), sem exigência de anualidade, formalizada por termo aditivo.",
  ])
    pdf.texto(`• ${l}`, { tam: 10, espaco: 3 });
  pdf.titulo("Anexos comprobatórios", 12);
  const anexos = [
    "Requerimento administrativo",
    "Memória de cálculo",
    "Planilha comparativa (vigente × proposta)",
    "Demonstrativo retroativo por competência",
    "Minuta de termo aditivo",
    ...p.documentos.map((x) => `Anexo: ${x.nome}`),
  ];
  for (const a of anexos) pdf.texto(`• ${a}`, { tam: 10, espaco: 2 });
  pdf.regua();
  pdf.texto("Documento de apoio gerado pela plataforma; não substitui a análise de profissional habilitado e não vincula a Administração.", { tam: 8, cor: COR.grafite });
  return pdf.bytes();
}

export async function retroativoPdf(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const { p, calc, comp } = d;
  const c = p.contrato;
  const m = marca(d);
  const pdf = await Pdf.criar(`Demonstrativo retroativo · Contrato ${c.numero} · ${m.nome}`, m.cor, await logoDe(m.logo));
  if (simulacaoJornada(d)) pdf.selo(MARCA_SIMULACAO_JORNADA, COR.carimbo);
  pdf.titulo("Demonstrativo retroativo por competência");
  pdf.texto(`Contrato ${c.numero} · ${c.orgao} · ${c.empresa.razaoSocial}`, { tam: 11, negrito: true, espaco: 2 });
  pdf.texto(
    `Diferença mensal: ${brl(comp.diferencaMensal)} · efeitos pleiteados a partir de ${data(p.gatilho === "JORNADA_EC141" ? p.jornadaInicioEfeitos ?? p.dataBase : p.dataBase)} · referência ${data(calc.dataReferencia)}.`,
    { cor: COR.grafite, espaco: 8 },
  );
  if (calc.retroativo?.meses.length) {
    pdf.tabela(
      ["Competência", "Dias", "Conta", "Valor"],
      [...calc.retroativo.meses.map((x) => [x.competencia, `${x.dias}/${x.diasNoMes}`, x.conta, brl(x.valor)]), ["Total", "", "", brl(calc.retroativo.total)]],
      [0.18, 0.12, 0.5, 0.2],
      ["e", "d", "e", "d"],
    );
    pdf.texto(`Regra: diferença ${calc.regraRetroativo}.`, { tam: 9, espaco: 4 });
    if (calc.jaPago) pdf.texto(`Retroativo bruto ${brl(calc.retroativoBruto!)}, menos ${brl(calc.jaPago)} já pagos pelo órgão no período.`, { tam: 9, espaco: 4 });
  } else pdf.texto("Sem diferença retroativa no período (início dos efeitos futuro, ou diferença zero ou negativa).", { tam: 10 });
  pdf.regua();
  pdf.texto("O retroativo considera a repercussão econômica comprovada e não presume crédito contra o órgão público.", { tam: 8, cor: COR.grafite });
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// 5.1: minuta do termo aditivo do pedido da jornada (texto jurídico novo: MINUTA)
// ---------------------------------------------------------------------------

export async function minutaAditivoPdf(pedidoId: string, contaId: string) {
  const d = await carregar(pedidoId, contaId);
  const { p, comp } = d;
  if (p.gatilho !== "JORNADA_EC141") throw new ErroUsuario("A minuta do aditivo é só do pedido da jornada.");
  const c = p.contrato;
  const e = c.empresa;
  const m = marca(d);
  // A4/A5: manter a cobertura e reorganizar as escalas mudam o valor; reduzir as horas muda as condições de execução
  const manter = p.cenarioJornada !== "REDUZIR_HORAS";
  const pdf = await Pdf.criar(`Minuta de termo aditivo · Contrato ${c.numero} · gerada por ${m.nome}`, m.cor, await logoDe(m.logo));
  pdf.selo("MINUTA, revise com seu jurídico", COR.carimbo);
  if (simulacaoJornada(d)) pdf.selo(MARCA_SIMULACAO_JORNADA, COR.carimbo);
  pdf.titulo(`Termo aditivo nº ____ ao Contrato nº ${c.numero}`);
  const blocos = [
    `CONTRATANTE: ${c.orgao}${c.orgaoCnpj ? `, CNPJ ${formatarCnpj(c.orgaoCnpj)}` : ""}.`,
    `CONTRATADA: ${e.razaoSocial}, CNPJ ${formatarCnpj(e.cnpj)}.`,
    "FUNDAMENTO: art. 9º da Emenda Constitucional nº 141/2026 e arts. 124 e 134 da Lei nº 14.133/2021.",
    `CLÁUSULA PRIMEIRA. DO OBJETO. Este termo aditivo adequa o contrato à redução da duração do trabalho de ${p.jornadaAntes} para ${p.jornadaDepois} horas semanais, decorrente da Emenda Constitucional nº 141/2026.`,
    manter
      ? `CLÁUSULA SEGUNDA. DO VALOR. ${p.cenarioJornada === "REORGANIZAR_ESCALAS" ? "Com a reorganização das escalas demonstrada nos anexos" : `Mantidas as ${Number(p.horasCobertura)} horas semanais de cobertura por posto`}, o valor mensal do contrato passa de ${brl(comp.mensalAntes)} para ${brl(comp.mensalAgora)}, conforme a planilha comparativa e a memória de cálculo anexas.`
      : `CLÁUSULA SEGUNDA. DAS CONDIÇÕES DE EXECUÇÃO. Pelo valor mensal de ${brl(comp.mensalAgora)}, conforme negociado entre as partes, as horas de serviço de cada posto passam de ${Number(p.horasCobertura)} para ${horasReduzidas(Number(p.horasCobertura), p.jornadaAntes!, p.jornadaDepois!).toString().replace(".", ",")} horas semanais.`,
    `CLÁUSULA TERCEIRA. DOS EFEITOS. Os efeitos deste termo valem a partir de ${data(p.jornadaInicioEfeitos ?? p.inicioJornada ?? p.dataBase)}.`,
    "CLÁUSULA QUARTA. DA RATIFICAÇÃO. Ficam mantidas as demais cláusulas do contrato que não conflitem com este termo.",
    `${c.municipio ?? "________"}, ____ de ____________ de ______.`,
  ];
  for (const b of blocos) pdf.texto(b, { tam: 10.5, espaco: 8 });
  pdf.y -= 20;
  pdf.texto("______________________________________          ______________________________________", { tam: 10 });
  pdf.texto(`${c.orgao}          ${e.razaoSocial}`, { tam: 9, cor: COR.grafite });
  return pdf.bytes();
}

// ---------------------------------------------------------------------------
// Relatório do Raio-X
// ---------------------------------------------------------------------------

export async function raioXPdf(resultado: ResultadoRaioX) {
  const r = comUmPorCento(resultado);
  const pdf = await Pdf.criar(`Raio-X Equapar · dados públicos do PNCP consultados em ${dataLocal(r.consultadoEm)}`);
  pdf.titulo("Raio-X dos contratos públicos", 20);
  pdf.texto(`${r.razaoSocial ?? "Empresa"} · CNPJ ${formatarCnpj(r.cnpj)}`, { tam: 12, negrito: true, espaco: 2 });
  const seis = r.contratos.filter((c) => {
    const s = seloVigencia(c.fim);
    return s.tom !== "neutro";
  }).length;
  pdf.texto(`${r.contratos.length} contratos vigentes no PNCP. ${seis} terminam nos próximos 6 meses.`, { espaco: 10 });
  // 5.4: só fatos públicos (valor global publicado no PNCP e tempo até o fim da vigência) e, a partir deles, quanto vale
  // 1% de reajuste por mês (valor global ÷ meses de vigência × 1%); nenhuma estimativa de valor a recuperar
  if (r.umPorCentoMesTotal != null) {
    const comValor = r.contratos.filter((c) => c.umPorCentoMes != null).length;
    pdf.texto(
      `Cada 1% de reajuste vale cerca de ${reais(r.umPorCentoMesTotal)} por mês${comValor < r.contratos.length ? ` nos ${plural(comValor, "contrato", "contratos")} com valor e vigência publicados` : ""}.`,
      { negrito: true, espaco: 2 },
    );
    pdf.texto("Estimativa a partir do valor publicado no PNCP. Não é promessa de recuperação.", { tam: 8, cor: COR.grafite, espaco: 10 });
  }
  pdf.tabela(
    ["Órgão", "Objeto", "Valor global (PNCP)", "Cada 1% de reajuste", "Fim da vigência", "Prazo"],
    r.contratos.map((c) => [
      c.orgao,
      c.objeto.slice(0, 110),
      c.valorGlobal != null ? reais(c.valorGlobal) : "—",
      c.umPorCentoMes != null ? `cerca de ${reais(c.umPorCentoMes)} por mês` : "—",
      `${data(c.fim)} (${tempoAteFim(diasAte(c.fim))})`,
      seloVigencia(c.fim).texto,
    ]),
    [0.2, 0.27, 0.13, 0.14, 0.15, 0.11],
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
    "Este relatório usa só dados públicos do Portal Nacional de Contratações Públicas (PNCP). Ele não estima valor a recuperar: isso depende da planilha de custos e da convenção, que o CNPJ não revela. O valor de 1% de reajuste é só uma ordem de grandeza, calculada pelo valor global publicado dividido pelos meses de vigência. Contratos antigos podem não ter sido publicados no PNCP.",
    { tam: 8, cor: COR.grafite },
  );
  return pdf.bytes();
}
