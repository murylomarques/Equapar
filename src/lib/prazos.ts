import type { Contrato, Convencao, Pedido } from "@prisma/client";
import { addMeses, data, diasAte, emDias, hojeUTC } from "./format";

/**
 * Regras de prazo (Dossiê, Dor 2; Produto e experiência, Fluxos 4 e 5).
 * Cada regra carrega a fonte, para a tela mostrar "a regra e a fonte daquele contrato".
 */

export const FONTES = {
  preclusao: {
    texto: "Para o TCU, assinar a prorrogação sem pedir a repactuação encerra o direito (preclusão lógica).",
    fonte: "TCU, Licitações e Contratos, 6.3",
    url: "https://licitacoesecontratos.tcu.gov.br/6-3-manutencao-e-prorrogacao-do-contrato/",
  },
  ressalva: {
    texto: "Com a convenção ainda pendente na data da prorrogação, o TCU admite ressalvar o direito no termo aditivo.",
    fonte: "TCU, Acórdão 1.827/2008-Plenário, segundo a Zênite",
    url: "https://zenite.blog.br/cct-nao-depositada-x-direito-a-repactuacao-apos-a-prorrogacao/",
  },
  resposta: {
    texto: "Nos contratos com mão de obra, a resposta ao pedido tem prazo preferencial de 1 mês, contado da entrega da documentação.",
    fonte: "Lei 14.133/2021, art. 92, § 6º, via TCU",
    url: "https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/",
  },
  analitica: {
    texto: "O pedido precisa da demonstração analítica da variação dos custos, pela planilha ou pela convenção que o fundamenta.",
    fonte: "Lei 14.133/2021, art. 135, § 6º, via TCU",
    url: "https://licitacoesecontratos.tcu.gov.br/6-2-2-1-3-repactuacao/",
  },
  indice: {
    texto: "Reajuste por índice segue a cláusula do contrato e regra própria; a preclusão do TCU trata da repactuação.",
    fonte: "Dossiê Equapar, Dor 2",
    url: "https://licitacoesecontratos.tcu.gov.br/6-3-manutencao-e-prorrogacao-do-contrato/",
  },
} as const;

export type Tom = "verde" | "ambar" | "carimbo" | "azul" | "neutro";

export interface Selo {
  texto: string;
  tom: Tom;
  icone: "relogio" | "carimbo" | "alerta" | "ampulheta" | "cifrao" | "check";
}

type ContratoComRel = Contrato & { convencao: Convencao | null; pedidos: Pedido[] };

const ABERTOS = ["EM_ANALISE", "CALCULO_VALIDADO"] as const;

/** Data-base mais recente que já passou (aniversário do mês da convenção). */
export function ultimaDataBase(conv: Pick<Convencao, "mesDataBase">, hoje = hojeUTC()) {
  const ano = hoje.getUTCFullYear();
  const esteAno = new Date(Date.UTC(ano, conv.mesDataBase - 1, 1));
  return esteAno <= hoje ? esteAno : new Date(Date.UTC(ano - 1, conv.mesDataBase - 1, 1));
}

export function proximaDataBase(conv: Pick<Convencao, "mesDataBase">, hoje = hojeUTC()) {
  const ano = hoje.getUTCFullYear();
  const esteAno = new Date(Date.UTC(ano, conv.mesDataBase - 1, 1));
  return esteAno > hoje ? esteAno : new Date(Date.UTC(ano + 1, conv.mesDataBase - 1, 1));
}

export function prazoResposta(p: Pick<Pedido, "protocoloData">) {
  return p.protocoloData ? addMeses(p.protocoloData, 1) : null;
}

/**
 * Há repactuação a pedir? Sim quando o contrato é de repactuação com mão de obra, tem convenção,
 * e a última data-base é posterior à proposta/último pedido (ninguém pediu a convenção nova ainda).
 */
export function oportunidade(c: ContratoComRel, hoje = hojeUTC()) {
  if (c.tipoReajuste !== "REPACTUACAO" || !c.maoDeObraDedicada || !c.convencao) return null;
  const db = ultimaDataBase(c.convencao, hoje);
  const referencia = c.dataProposta ?? c.vigenciaInicio;
  if (db <= referencia) return null;
  const pedidoCobre = c.pedidos.some((p) => p.estado !== "INDEFERIDO" && p.dataBase && p.dataBase >= db);
  const pedidoAberto = c.pedidos.find((p) => (ABERTOS as readonly string[]).includes(p.estado) && (!p.dataBase || p.dataBase >= db));
  if (pedidoCobre && !pedidoAberto) return null;
  return { dataBase: db, pedirAte: c.vigenciaFim, pedidoAberto: pedidoAberto ?? null };
}

export function seloSituacao(c: ContratoComRel, hoje = hojeUTC()): Selo {
  const protocolado = c.pedidos.find((p) => p.estado === "PROTOCOLADO");
  if (protocolado) return { texto: "Aguardando o órgão", tom: "azul", icone: "ampulheta" };
  const deferido = c.pedidos.find((p) => p.estado === "DEFERIDO");
  if (deferido) return { texto: "Deferido: faturar", tom: "verde", icone: "carimbo" };
  if (c.tipoReajuste === "REPACTUACAO" && c.maoDeObraDedicada && !c.convencao)
    return { texto: "Sem convenção", tom: "ambar", icone: "alerta" };
  const op = oportunidade(c, hoje);
  if (op) {
    const d = diasAte(op.pedirAte);
    return { texto: `Pedir até ${data(op.pedirAte)}`, tom: d <= 30 ? "carimbo" : "ambar", icone: "relogio" };
  }
  return { texto: "Em dia", tom: "verde", icone: "check" };
}

/** Selo do Raio-X: até 60 dias, 60 a 180 dias, depois. */
export function seloVigencia(fim: Date | string): Selo {
  const d = diasAte(fim);
  if (d <= 60) return { texto: `Termina ${emDias(d)}`, tom: "carimbo", icone: "relogio" };
  if (d <= 180) return { texto: `Termina ${emDias(d)}`, tom: "ambar", icone: "relogio" };
  return { texto: `Vigente até ${new Date(fim).getUTCFullYear()}`, tom: "neutro", icone: "check" };
}

export interface Prazo {
  data: Date;
  titulo: string;
  regra?: (typeof FONTES)[keyof typeof FONTES];
  tipo: "pedir" | "fim" | "database" | "resposta";
}

export function prazosDoContrato(c: ContratoComRel, hoje = hojeUTC()): Prazo[] {
  const lista: Prazo[] = [];
  const op = oportunidade(c, hoje);
  if (op) lista.push({ data: op.pedirAte, titulo: "Data-limite para pedir a repactuação (antes da prorrogação)", regra: FONTES.preclusao, tipo: "pedir" });
  lista.push({
    data: c.vigenciaFim,
    titulo: "Fim da vigência",
    regra: c.tipoReajuste === "INDICE" ? FONTES.indice : FONTES.preclusao,
    tipo: "fim",
  });
  if (c.convencao) lista.push({ data: proximaDataBase(c.convencao, hoje), titulo: `Data-base da convenção (${c.convencao.nome})`, tipo: "database" });
  for (const p of c.pedidos) {
    const r = p.estado === "PROTOCOLADO" ? prazoResposta(p) : null;
    if (r) lista.push({ data: r, titulo: "Prazo preferencial de resposta do órgão", regra: FONTES.resposta, tipo: "resposta" });
  }
  return lista.sort((a, b) => a.data.getTime() - b.data.getTime());
}

export function proximoPrazo(c: ContratoComRel, hoje = hojeUTC()) {
  return prazosDoContrato(c, hoje).find((p) => p.data >= hoje) ?? null;
}

// ---------------------------------------------------------------------------
// Ações da tela Hoje ("Precisa de você")
// ---------------------------------------------------------------------------

export interface Acao {
  chave: string;
  titulo: string;
  contratoId: string;
  contratoNumero: string;
  orgao: string;
  limite: Date | null;
  detalhe: string;
  botao: string;
  href: string;
  tom: Tom;
}

export function acoesDoContrato(c: ContratoComRel, hoje = hojeUTC()): Acao[] {
  const out: Acao[] = [];
  const base = { contratoId: c.id, contratoNumero: c.numero, orgao: c.orgao };
  const diasFim = diasAte(c.vigenciaFim);
  const op = oportunidade(c, hoje);
  if (op) {
    out.push({
      ...base,
      chave: `pedir:${c.id}`,
      titulo: "Pedir repactuação",
      limite: op.pedirAte,
      detalhe: `prorrogação ${emDias(diasFim)}`,
      botao: op.pedidoAberto ? "Continuar pedido" : "Montar pedido",
      href: op.pedidoAberto ? `/app/pedidos/${op.pedidoAberto.id}` : `/app/pedidos/novo?contrato=${c.id}`,
      tom: diasFim <= 30 ? "carimbo" : "ambar",
    });
  } else if (diasFim >= 0 && diasFim <= 60) {
    out.push({
      ...base,
      chave: `prorrogacao:${c.id}`,
      titulo: "Decidir antes da prorrogação",
      limite: c.vigenciaFim,
      detalhe: `termina ${emDias(diasFim)}`,
      botao: "Ver o que fazer",
      href: `/app/contratos/${c.id}/prorrogacao`,
      tom: diasFim <= 30 ? "carimbo" : "ambar",
    });
  }
  if (c.tipoReajuste === "REPACTUACAO" && c.maoDeObraDedicada && !c.convencao) {
    out.push({ ...base, chave: `conv:${c.id}`, titulo: "Informar a convenção coletiva", limite: null, detalhe: "sem ela não há como avisar a data-base", botao: "Informar", href: `/app/contratos/${c.id}?aba=resumo`, tom: "ambar" });
  }
  for (const p of c.pedidos) {
    if (p.estado === "DEFERIDO" && !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm) <= -30) {
      out.push({ ...base, chave: `apost:${p.id}`, titulo: "Cobrar o apostilamento", limite: null, detalhe: `deferido ${emDias(diasAte(p.deferidoEm))}, sem apostilamento`, botao: "Abrir", href: `/app/a-receber`, tom: "carimbo" });
    } else if (p.estado === "DEFERIDO" && p.apostiladoEm) {
      out.push({ ...base, chave: `fat:${p.id}`, titulo: "Faturar a diferença", limite: null, detalhe: "apostilado, falta a nota da diferença retroativa", botao: "Gerar cobrança", href: `/app/a-receber`, tom: "verde" });
    } else if (p.estado === "CALCULO_VALIDADO" && !p.protocoloNumero) {
      out.push({ ...base, chave: `prot:${p.id}`, titulo: "Protocolar o pedido", limite: c.vigenciaFim, detalhe: "pedido pronto, falta registrar o protocolo", botao: "Abrir pedido", href: `/app/pedidos/${p.id}/pronto`, tom: "ambar" });
    }
  }
  return out;
}
