/**
 * Central de avisos: transforma as mensagens disparadas (uma por canal e destinatário) em EVENTOS de negócio
 * acionáveis. Regras puras; a página carrega os dados da conta e chama `classificar`.
 *
 * Segurança dos links: o destino nunca sai do texto da mensagem. Sai do tipo do aviso e de identificadores
 * (contratoId da linha; pedidoId da chave gerada pelo próprio servidor) que a página confere no banco,
 * dentro da conta, antes de passar para cá. Entidade não encontrada = sem link.
 */
import { diasAte } from "./format";

export type EnvioAviso = { id: string; canal: string; destino: string; status: string; erro: string | null; enviadoEm: Date; corpo: string; assunto: string | null };
export type EventoAviso = { chave: string; tipo: string; contratoId: string | null; pedidoId: string | null; ultimoEnvio: Date; envios: EnvioAviso[] };

/** Tipos cuja chave é "TIPO:<pedidoId>[:...]" (formato escrito em lib/avisos.ts). */
const TIPOS_DE_PEDIDO = new Set(["RESPOSTA", "DEFERIDO", "APOSTILAMENTO"]);

export function pedidoDaChave(tipo: string, chave: string): string | null {
  if (!TIPOS_DE_PEDIDO.has(tipo)) return null;
  const id = chave.split(":")[1];
  return id && /^[a-z0-9]{10,40}$/i.test(id) ? id : null;
}

/** Uma ocorrência por evento de negócio, com o histórico de cada canal. */
export function agrupar(avisos: (EnvioAviso & { chave: string; tipo: string; contratoId: string | null })[]): EventoAviso[] {
  const m = new Map<string, EventoAviso>();
  for (const a of avisos) {
    const ev = m.get(a.chave) ?? { chave: a.chave, tipo: a.tipo, contratoId: a.contratoId, pedidoId: pedidoDaChave(a.tipo, a.chave), ultimoEnvio: a.enviadoEm, envios: [] };
    ev.envios.push({ id: a.id, canal: a.canal, destino: a.destino, status: a.status, erro: a.erro, enviadoEm: a.enviadoEm, corpo: a.corpo, assunto: a.assunto });
    if (a.enviadoEm > ev.ultimoEnvio) ev.ultimoEnvio = a.enviadoEm;
    m.set(a.chave, ev);
  }
  return [...m.values()].sort((a, b) => b.ultimoEnvio.getTime() - a.ultimoEnvio.getTime());
}

export type ContratoAviso = { id: string; numero: string; orgao: string; vigenciaFim: Date; arquivado: boolean };
export type PedidoAviso = { id: string; estado: string; apostiladoEm: Date | null; contratoId: string };
export type Situacao = "PENDENTE" | "RESOLVIDO" | "INFORMATIVO";
export type Prioridade = "ALTA" | "MEDIA" | "BAIXA";

export type Classificado = {
  categoria: "ACAO" | "PRAZO" | "INFO";
  situacao: Situacao;
  prioridade: Prioridade;
  titulo: string;
  resumo: string;
  objeto: string | null;
  acao: { rotulo: string; href: string } | null;
  /** data relevante (prazo) para mostrar ao lado */
  prazo: Date | null;
};

const PESO: Record<Prioridade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
export function ordenar<T extends { c: Classificado; ev: EventoAviso }>(xs: T[]) {
  const ordemSituacao: Record<Situacao, number> = { PENDENTE: 0, INFORMATIVO: 1, RESOLVIDO: 2 };
  return [...xs].sort(
    (a, b) =>
      ordemSituacao[a.c.situacao] - ordemSituacao[b.c.situacao] ||
      PESO[a.c.prioridade] - PESO[b.c.prioridade] ||
      (a.c.prazo && b.c.prazo ? a.c.prazo.getTime() - b.c.prazo.getTime() : 0) ||
      b.ev.ultimoEnvio.getTime() - a.ev.ultimoEnvio.getTime(),
  );
}

const br = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
const nomeContrato = (c: ContratoAviso) => `Contrato ${c.numero}`;

/** Próximo passo do pedido depois do deferimento (o mesmo da tela do pedido). */
function passoFinanceiro(p: PedidoAviso, c: ContratoAviso | null, base: string): Classificado {
  const objeto = c ? `${nomeContrato(c)} · ${c.orgao}` : null;
  const href = `/app/pedidos/${p.id}/pronto`;
  if (p.estado === "DEFERIDO" && !p.apostiladoEm)
    return { categoria: "ACAO", situacao: "PENDENTE", prioridade: "ALTA", titulo: `${c ? nomeContrato(c) : "Pedido"}: registrar o apostilamento`, resumo: `${base} Sem o apostilamento, o órgão não paga a diferença.`, objeto, acao: { rotulo: "Registrar o apostilamento", href }, prazo: null };
  if (p.estado === "DEFERIDO")
    return { categoria: "ACAO", situacao: "PENDENTE", prioridade: "MEDIA", titulo: `${c ? nomeContrato(c) : "Pedido"}: registrar a nota fiscal da diferença`, resumo: `${base} Apostilamento registrado; falta faturar a diferença.`, objeto, acao: { rotulo: "Registrar nota fiscal", href }, prazo: null };
  if (p.estado === "FATURADO")
    return { categoria: "ACAO", situacao: "PENDENTE", prioridade: "MEDIA", titulo: `${c ? nomeContrato(c) : "Pedido"}: acompanhar o recebimento`, resumo: `${base} Diferença faturada; registre cada pagamento quando entrar.`, objeto, acao: { rotulo: "Registrar recebimento", href }, prazo: null };
  if (p.estado === "RECEBIDO")
    return { categoria: "ACAO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${c ? nomeContrato(c) : "Pedido"}: diferença recebida`, resumo: "Este pedido foi concluído.", objeto, acao: { rotulo: "Ver o pedido", href }, prazo: null };
  return { categoria: "ACAO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${c ? nomeContrato(c) : "Pedido"}: situação mudou`, resumo: base, objeto, acao: { rotulo: "Ver o pedido", href }, prazo: null };
}

export function classificar(
  ev: EventoAviso,
  dados: { contrato: ContratoAviso | null; pedido: PedidoAviso | null; contaEmDia: boolean },
  agora = new Date(),
): Classificado {
  const { contrato: c, pedido: p } = dados;
  const objeto = c ? `${nomeContrato(c)} · ${c.orgao}` : null;
  const semDestino = (titulo: string, resumo: string): Classificado => ({ categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo, resumo, objeto, acao: null, prazo: null });

  switch (ev.tipo) {
    case "D60":
    case "D30":
    case "D7": {
      if (!c) return semDestino("Prazo de contrato", "O contrato deste aviso foi excluído da conta.");
      const dataAviso = ev.chave.split(":")[2];
      const prazos = { rotulo: "Ver prazos do contrato", href: `/app/contratos/${c.id}?aba=prazos` };
      if (c.arquivado) return { categoria: "PRAZO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${nomeContrato(c)}: contrato arquivado`, resumo: "O aviso de prazo não se aplica mais.", objeto, acao: prazos, prazo: null };
      if (dataAviso && c.vigenciaFim.toISOString().slice(0, 10) !== dataAviso)
        return { categoria: "PRAZO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${nomeContrato(c)}: vigência atualizada`, resumo: `O fim da vigência agora é ${br(c.vigenciaFim)}.`, objeto, acao: prazos, prazo: c.vigenciaFim };
      const dias = diasAte(c.vigenciaFim, agora);
      if (dias < 0) return { categoria: "PRAZO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${nomeContrato(c)}: vigência encerrada em ${br(c.vigenciaFim)}`, resumo: "Atualize a vigência se o contrato foi prorrogado.", objeto, acao: prazos, prazo: c.vigenciaFim };
      return {
        categoria: "PRAZO",
        situacao: "PENDENTE",
        prioridade: dias <= 7 ? "ALTA" : dias <= 30 ? "MEDIA" : "BAIXA",
        titulo: `${nomeContrato(c)}: fim da vigência ${dias === 0 ? "hoje" : `em ${dias} ${dias === 1 ? "dia" : "dias"}`}`,
        resumo: `A vigência registrada termina em ${br(c.vigenciaFim)}. Confira as condições de prorrogação e a situação do pedido de repactuação.`,
        objeto,
        acao: prazos,
        prazo: c.vigenciaFim,
      };
    }
    case "RESPOSTA": {
      if (!p) return semDestino(c ? `${nomeContrato(c)}: pedido protocolado` : "Pedido protocolado", "O pedido deste aviso foi excluído da conta.");
      const href = `/app/pedidos/${p.id}/pronto`;
      if (p.estado === "PROTOCOLADO")
        return { categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo: `${c ? nomeContrato(c) : "Pedido"}: aguardando a resposta do órgão`, resumo: "Pedido protocolado. Registre a resposta quando o órgão decidir.", objeto, acao: { rotulo: "Ver o pedido", href }, prazo: null };
      if (["DEFERIDO", "FATURADO", "RECEBIDO"].includes(p.estado)) return passoFinanceiro(p, c, "O órgão respondeu ao pedido.");
      return { categoria: "INFO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: `${c ? nomeContrato(c) : "Pedido"}: resposta registrada`, resumo: "A situação do pedido mudou.", objeto, acao: { rotulo: "Ver o pedido", href }, prazo: null };
    }
    case "DEFERIDO":
    case "APOSTILAMENTO":
      if (!p) return semDestino(c ? `${nomeContrato(c)}: pedido deferido` : "Pedido deferido", "O pedido deste aviso foi excluído da conta.");
      return passoFinanceiro(p, c, ev.tipo === "APOSTILAMENTO" ? "Deferido há mais de 30 dias e ainda sem apostilamento." : "O pedido foi deferido.");
    case "COBRANCA":
      return dados.contaEmDia
        ? { categoria: "ACAO", situacao: "RESOLVIDO", prioridade: "BAIXA", titulo: "Cobrança da assinatura", resumo: "Pagamento em dia.", objeto: null, acao: { rotulo: "Ver cobrança", href: "/app/configuracoes?aba=cobranca" }, prazo: null }
        : { categoria: "ACAO", situacao: "PENDENTE", prioridade: "ALTA", titulo: "Pagamento da assinatura pendente", resumo: "O pagamento não foi identificado. Regularize para não perder a edição da conta (nenhum dado é apagado).", objeto: null, acao: { rotulo: "Ver cobrança", href: "/app/configuracoes?aba=cobranca" }, prazo: null };
    case "SEMANAL":
      return { categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo: "Resumo semanal", resumo: "Prazos e pendências da semana.", objeto: null, acao: { rotulo: "Abrir Hoje", href: "/app/hoje" }, prazo: null };
    case "JORNADA":
      return { categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo: "Jornada de 40 horas", resumo: "Contratos da carteira afetados pela mudança da jornada.", objeto: null, acao: { rotulo: "Ver contratos afetados", href: "/app/carteira?filtro=jornada" }, prazo: null };
    case "SEGURANCA":
      return { categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo: "Aviso de segurança da conta", resumo: "Mudança no acesso à conta.", objeto: null, acao: { rotulo: "Ver segurança", href: "/app/configuracoes?aba=seguranca" }, prazo: null };
    case "CONVITE":
      return { categoria: "INFO", situacao: "INFORMATIVO", prioridade: "BAIXA", titulo: "Convite enviado", resumo: "Convite para a conta.", objeto: null, acao: { rotulo: "Ver pessoas", href: "/app/configuracoes?aba=pessoas" }, prazo: null };
    default:
      return semDestino(ev.envios[0]?.assunto ?? "Mensagem", "Mensagem registrada.");
  }
}
