import "server-only";
import { Prisma, type Plano } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "./db";
import { aplicarEvento, type Ciclo, type SituacaoCobranca, valorDoPlano } from "./planos";
import { cobranca, vencimentoNoGateway, type Metodo } from "./cobranca";
import { appUrl, enviar } from "./mensagens";
import { reais } from "./format";
import { faturaCancelavel, faturaDevida, fimDoPeriodo, planoEfetivo, situacaoPorAtraso, transicao, type EventoGateway, type FaturaRegra } from "./assinatura";
import { registrar } from "./registro";
import { registrarEvento } from "./eventos";
import { ErroUsuario } from "./acao";

type Tx = Prisma.TransactionClient;

/** Dias antes do fim do período em que a renovação é gerada. */
export const RENOVAR_DIAS_ANTES = 7;
/** Transações que chamam o gateway por dentro (para não abrir duas cobranças): tempo maior que o padrão de 5 s. */
const TX_COM_GATEWAY = { timeout: 30_000, maxWait: 15_000 };

type FaturaDb = Prisma.FaturaGetPayload<object>;
const regra = (f: FaturaDb): FaturaRegra => ({
  status: f.status,
  valor: f.valor.toString(),
  valorEstornado: f.valorEstornado.toString(),
  periodoInicio: f.periodoInicio,
  periodoFim: f.periodoFim,
  ciclo: f.ciclo,
  plano: f.plano,
  revisao: f.revisao,
  canceladaPelaEquapar: f.status === "CANCELADA" && !!f.motivoCancelamento,
});

async function postosCobrados(tx: Tx | typeof db, contaId: string) {
  const agg = await tx.contrato.aggregate({ where: { arquivado: false, maoDeObraDedicada: true, empresa: { contaId } }, _sum: { postos: true } });
  return agg._sum.postos ?? 0;
}

/** Uma decisão de cobrança por conta de cada vez (compra, cancelamento, mudança, renovação). */
async function travarConta(tx: Tx, contaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compra:${contaId}`}))`;
}

/**
 * Recalcula o plano efetivo da conta a partir das faturas (dentro da transação do chamador).
 * Trava a linha da conta: dois eventos de faturas diferentes da mesma conta não gravam um plano desatualizado.
 * A régua de cobrança de uma renovação devida e não paga anda pelo calendário (o gateway avisa uma vez só).
 */
export async function sincronizarPlano(tx: Tx, contaId: string, agora = new Date()) {
  await tx.$queryRaw`SELECT id FROM "Conta" WHERE id = ${contaId} FOR UPDATE`;
  const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
  const faturas = await tx.fatura.findMany({ where: { contaId } });
  const r = planoEfetivo(
    { plano: conta.plano, planoVigenteAte: conta.planoVigenteAte, renovacaoCancelada: conta.renovacaoCancelada, mudancaAgendada: conta.mudancaAgendada, mudancaAgendadaEm: conta.mudancaAgendadaEm },
    faturas.map(regra),
    agora,
  );
  const devidas = faturas.filter((f) => faturaDevida(regra(f), agora)).sort((a, b) => a.periodoInicio!.getTime() - b.periodoInicio!.getTime());
  let situacao: Prisma.ContaUpdateInput = {};
  if (!devidas.length) {
    if (conta.situacaoCobranca !== "EM_DIA") situacao = { situacaoCobranca: "EM_DIA", carenciaAte: null };
  } else {
    // a mais antiga devida manda; nunca alivia uma situação já mais grave
    const pelaData = situacaoPorAtraso(devidas[0].periodoInicio!, agora);
    const peso = { EM_DIA: 0, ATRASADA: 1, CARENCIA: 2, SOMENTE_LEITURA: 3 } as Record<string, number>;
    if (peso[pelaData.situacao] > (peso[conta.situacaoCobranca] ?? 0)) situacao = { situacaoCobranca: pelaData.situacao, carenciaAte: pelaData.carenciaAte ?? conta.carenciaAte };
  }
  const data: Prisma.ContaUpdateInput = {
    plano: r.plano,
    planoVigenteAte: r.planoVigenteAte,
    // o ciclo da renovação acompanha o período pago em vigor (salvo troca de ciclo já agendada e ainda futura)
    ...(r.ciclo && (!conta.mudancaAgendada || r.limparAgendamento) ? { ciclo: r.ciclo } : {}),
    ...(r.limparAgendamento ? { mudancaAgendada: null, mudancaAgendadaEm: null } : {}),
    ...situacao,
  };
  await tx.conta.update({ where: { id: contaId }, data });
  return r;
}

/** Marca como canceladas, na transação, as faturas em aberto que ainda não começaram. Devolve as que têm cobrança no gateway. */
async function cancelarNaoIniciadas(tx: Tx, contaId: string, motivo: string, agora: Date, filtro?: (f: FaturaDb) => boolean) {
  const abertas = await tx.fatura.findMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } } });
  const alvo = abertas.filter((f) => faturaCancelavel(regra(f), agora) && (!filtro || filtro(f)));
  if (alvo.length) await tx.fatura.updateMany({ where: { id: { in: alvo.map((f) => f.id) } }, data: { status: "CANCELADA", canceladaEm: agora, motivoCancelamento: motivo } });
  return alvo.map((f) => ({ id: f.id, gatewayId: f.gatewayId }));
}

/** Remove no gateway as cobranças já canceladas aqui. Falha no gateway não reabre nada (reconcilia pelo webhook ou à mão). */
async function cancelarNoGateway(faturas: { id: string; gatewayId: string | null }[]) {
  const g = cobranca();
  for (const f of faturas) {
    if (!f.gatewayId) continue;
    try {
      await g.cancelarCobranca(f.gatewayId);
    } catch (e) {
      registrar("erro", "cancelar_cobranca_gateway", { faturaId: f.id, erro: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Cria a cobrança no gateway para uma fatura que ainda não tem (dentro da trava da conta: nunca duas para a mesma fatura). */
async function garantirCobrancaNoGateway(tx: Tx, faturaId: string, metodo: Metodo | "ESCOLHER", email: string) {
  const f = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, include: { conta: { include: { empresas: { take: 1, orderBy: { criadoEm: "asc" } } } } } });
  if (f.gatewayId && f.linkPagamento) return f;
  const g = cobranca();
  const conta = f.conta;
  const clienteId = await g.garantirCliente({ contaId: conta.id, nome: conta.empresas[0]?.razaoSocial ?? conta.nome, cpfCnpj: conta.empresas[0]?.cnpj ?? "", email, clienteIdAtual: conta.gatewayClienteId });
  const c = await g.criarCobranca({ clienteId, valor: f.valor.toFixed(2), vencimento: vencimentoNoGateway(f.vencimento), descricao: f.descricao, referenciaExterna: f.id, metodo });
  if (conta.gatewayClienteId !== clienteId) await tx.conta.update({ where: { id: conta.id }, data: { gatewayClienteId: clienteId } });
  return tx.fatura.update({ where: { id: f.id }, data: { gatewayId: c.id, linkPagamento: c.link } });
}

/**
 * Abre a cobrança de uma compra de plano. O plano NÃO muda aqui: a fatura diz o que compra e o acesso começa
 * quando o pagamento for confirmado. A decisão inteira, inclusive a chamada ao gateway, acontece com a conta
 * travada: dois cliques ou duas abas recebem a mesma cobrança, nunca duas.
 * Cancelamento ou mudança agendados continuam valendo até a compra ser paga.
 */
export async function abrirCobrancaDoPlano(
  contaId: string,
  plano: Plano,
  ciclo: Ciclo,
  metodo: Metodo | "ESCOLHER",
  email: string,
  agora = new Date(),
  opcoes: { analiseManual?: boolean } = {},
) {
  const r = await db.$transaction(async (tx) => {
    await travarConta(tx, contaId);
    const abertas = await tx.fatura.findMany({ where: { contaId, status: { in: ["ABERTA", "FALHOU"] } } });
    // regras conferidas de novo com a conta travada (a tela pode ter visto um estado anterior):
    // renovação vencida e devida em aberto: a compra cobraria o mesmo período duas vezes
    if (abertas.some((f) => faturaDevida(regra(f), agora)))
      throw new ErroUsuario("Há uma renovação vencida em aberto. Pague essa fatura para regularizar; a mudança de plano fica para depois.");
    // compra com período pago em andamento é combinada à mão (sem crédito aprovado, a cobrança seria ambígua)
    if (!opcoes.analiseManual) {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
      if (conta.plano !== "GRATIS" && conta.planoVigenteAte && conta.planoVigenteAte > agora)
        throw new ErroUsuario("Seu plano atual tem período pago em andamento. Fale com a gente para combinar a mudança antes de qualquer cobrança.");
    }
    // a mesma compra ainda pagável: devolve a mesma cobrança (idempotente)
    const igual = abertas.find((f) => !f.renovacao && f.status === "ABERTA" && f.plano === plano && f.ciclo === ciclo && faturaCancelavel(regra(f), agora) && (!f.vencimento || f.vencimento >= agora));
    if (igual) return { fatura: await garantirCobrancaNoGateway(tx, igual.id, metodo, email), cancelar: [] as { id: string; gatewayId: string | null }[], revisar: [] as string[] };
    // tudo que ainda não começou (compra anterior ou renovação futura) é substituído pela compra nova
    const cancelar = await cancelarNaoIniciadas(tx, contaId, "Substituída por outra escolha de plano", agora);
    // renovação já PAGA para um período futuro: com o upgrade, os períodos se sobrepõem; fica marcada para devolução
    const sobrepostas = await tx.fatura.findMany({ where: { contaId, status: "PAGA", renovacao: true, periodoInicio: { gt: agora }, revisao: null }, select: { id: true } });
    if (sobrepostas.length) await tx.fatura.updateMany({ where: { id: { in: sobrepostas.map((f) => f.id) } }, data: { revisao: "RENOVACAO_PAGA_SOBREPOSTA" } });
    const postos = await postosCobrados(tx, contaId);
    const valor = valorDoPlano(plano, { postos, ciclo });
    const nova = await tx.fatura.create({
      data: {
        contaId,
        referencia: agora.toISOString().slice(0, 7),
        descricao: `Plano ${plano.toLowerCase()} (${ciclo === "ANUAL" ? "anual" : "mensal"})`,
        valor: valor.toFixed(2),
        postos,
        vencimento: new Date(agora.getTime() + 3 * 86_400_000),
        metodo: metodo === "ESCOLHER" ? null : metodo,
        plano,
        ciclo,
      },
    });
    // planoPendente fica só para leitura das telas antigas; cancelamento/agendamento só caem quando a compra for paga
    await tx.conta.update({ where: { id: contaId }, data: { planoPendente: plano } });
    return { fatura: await garantirCobrancaNoGateway(tx, nova.id, metodo, email), cancelar, revisar: sobrepostas.map((f) => f.id) };
  }, TX_COM_GATEWAY);
  await cancelarNoGateway(r.cancelar);
  await avisarEquipeRevisao(r.revisar);
  return { faturaId: r.fatura.id, link: r.fatura.linkPagamento ?? "", valor: r.fatura.valor.toFixed(2), modo: cobranca().modo };
}

/** Cancela a renovação: o acesso pago segue até o fim do período; cobranças futuras deixam de existir. */
export async function cancelarRenovacao(contaId: string, agora = new Date()) {
  const r = await db.$transaction(async (tx) => {
    await travarConta(tx, contaId);
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
    const ativo = !!conta.planoVigenteAte && conta.planoVigenteAte > agora && conta.plano !== "GRATIS";
    const canceladas = await cancelarNaoIniciadas(tx, contaId, "Cancelamento pedido pelo cliente", agora);
    await tx.conta.update({
      where: { id: contaId },
      data: ativo
        ? { renovacaoCancelada: true, mudancaAgendada: "GRATIS", mudancaAgendadaEm: conta.planoVigenteAte, planoPendente: null }
        : { renovacaoCancelada: true, mudancaAgendada: null, mudancaAgendadaEm: null, planoPendente: null, ...(conta.plano !== "PILOTO" ? { plano: "GRATIS" } : {}) },
    });
    await sincronizarPlano(tx, contaId, agora);
    return { agendado: ativo, ate: ativo ? conta.planoVigenteAte : null, canceladas };
  });
  await cancelarNoGateway(r.canceladas);
  return { agendado: r.agendado, ate: r.ate, canceladas: r.canceladas.length };
}

/** Desfaz o cancelamento antes da data: a renovação volta a valer. Nada é cobrado agora. */
export async function reativarRenovacao(contaId: string) {
  await db.$transaction(async (tx) => {
    await travarConta(tx, contaId);
    await tx.conta.update({ where: { id: contaId }, data: { renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null } });
  });
}

/** Downgrade entre planos pagos (ou troca de ciclo): vale na renovação. A renovação já gerada no plano antigo é substituída. */
export async function agendarMudanca(contaId: string, plano: Plano, agora = new Date()) {
  const r = await db.$transaction(async (tx) => {
    await travarConta(tx, contaId);
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
    if (!conta.planoVigenteAte || conta.planoVigenteAte <= agora) throw new Error("Sem período pago em andamento para agendar a mudança.");
    const canceladas = await cancelarNaoIniciadas(tx, contaId, `Renovação substituída pelo plano ${plano.toLowerCase()}`, agora, (f) => f.renovacao);
    await tx.conta.update({ where: { id: contaId }, data: { mudancaAgendada: plano, mudancaAgendadaEm: conta.planoVigenteAte, renovacaoCancelada: false } });
    return { ate: conta.planoVigenteAte, canceladas };
  });
  await cancelarNoGateway(r.canceladas);
  return r.ate;
}

/**
 * Processa um evento de pagamento (webhook ou simulação), numa transação só:
 *  1. registra o id do evento (ON CONFLICT DO NOTHING): a mesma entrega repetida, mesmo simultânea, vale uma vez;
 *  2. trava a fatura (SELECT … FOR UPDATE) e, no recálculo, a conta;
 *  3. aplica a transição (monotônica: evento fora de ordem não desfaz o que já aconteceu);
 *  4. recalcula o plano da conta pelos períodos pagos.
 * Nunca apaga dados: no pior caso, a conta fica somente leitura depois da carência.
 */
export async function processarEventoPagamento(opts: {
  faturaId?: string;
  gatewayId?: string;
  evento: EventoGateway;
  eventoId?: string;
  tipoOriginal?: string;
  dataEvento?: Date;
  valorEstornado?: string;
  agora?: Date;
}) {
  const agora = opts.agora ?? new Date();
  const r = await db.$transaction(
    async (tx) => {
      if (opts.eventoId) {
        const novo = await tx.eventoCobranca.createMany({
          data: [{ id: opts.eventoId, tipo: opts.tipoOriginal ?? opts.evento, gatewayId: opts.gatewayId ?? null, faturaId: opts.faturaId ?? null, dataEvento: opts.dataEvento ?? null }],
          skipDuplicates: true,
        });
        if (novo.count === 0) return { resultado: "repetido" as const };
      }
      // pelo id do gateway; se não achar, pela referência externa (id da fatura na Equapar)
      let travada: { id: string } | undefined;
      if (opts.gatewayId) travada = (await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Fatura" WHERE "gatewayId" = ${opts.gatewayId} FOR UPDATE`)[0];
      const viaReferencia = !travada && !!opts.gatewayId;
      if (!travada && opts.faturaId) travada = (await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Fatura" WHERE id = ${opts.faturaId} FOR UPDATE`)[0];
      if (!travada) {
        if (opts.eventoId) await tx.eventoCobranca.update({ where: { id: opts.eventoId }, data: { resultado: "fatura-nao-encontrada" } });
        return { resultado: "fatura-nao-encontrada" as const };
      }
      const f = await tx.fatura.findUniqueOrThrow({ where: { id: travada.id }, include: { conta: true } });
      // cobrança do gateway que não é a cobrança atual da fatura (ex.: duplicada) paga em cima de fatura já paga:
      // não compra nada; fica marcada para devolução
      if (viaReferencia && opts.evento === "PAGO" && f.gatewayId && f.gatewayId !== opts.gatewayId && f.status === "PAGA") {
        // revisão já resolvida volta a ficar pendente: é outro pagamento a devolver
        await tx.fatura.update({ where: { id: f.id }, data: { revisao: "PAGAMENTO_DUPLICADO", revisaoResolvidaEm: null, revisaoResolvidaPor: null } });
        if (opts.eventoId) await tx.eventoCobranca.update({ where: { id: opts.eventoId }, data: { resultado: "pagamento duplicado: devolver", faturaId: f.id } });
        return { resultado: "processado" as const, motivo: "pagamento duplicado", contaId: f.contaId, valor: f.valor.toString(), link: f.linkPagamento, avisar: null, carenciaAte: null, revisar: f.id };
      }
      const t = transicao(regra(f), opts.evento, agora, { valorEstornado: opts.valorEstornado });
      let avisar: "pago" | "atrasada" | "carencia" | null = null;
      let carenciaAte: Date | null = null;
      if (t.mudou) {
        const dados: Prisma.FaturaUpdateInput = {};
        if (t.status) dados.status = t.status;
        if (t.status === "PAGA") dados.pagaEm = agora;
        if (t.status === "CANCELADA") dados.canceladaEm = agora;
        if (t.status === "ABERTA") Object.assign(dados, { canceladaEm: null, motivoCancelamento: null });
        if (t.periodo) Object.assign(dados, { periodoInicio: t.periodo.inicio, periodoFim: t.periodo.fim });
        if (t.valorEstornado) dados.valorEstornado = t.valorEstornado;
        if (t.revisao) Object.assign(dados, { revisao: t.revisao, revisaoResolvidaEm: null, revisaoResolvidaPor: null });
        if (t.vencimento) {
          const v = aplicarEvento({ faturaStatus: f.status, tentativas: f.tentativas, situacao: f.conta.situacaoCobranca as SituacaoCobranca, carenciaAte: f.conta.carenciaAte }, "VENCIDO", agora);
          Object.assign(dados, v.fatura, v.novaTentativaEm ? { vencimento: v.novaTentativaEm } : {});
          // régua (situação da conta e e-mail) só para fatura devida: compra que nunca começou não pune a conta
          if (faturaDevida(regra(f), agora)) {
            if (v.conta) await tx.conta.update({ where: { id: f.contaId }, data: { situacaoCobranca: v.conta.situacao, carenciaAte: v.conta.carenciaAte } });
            avisar = v.avisar;
            carenciaAte = v.conta?.carenciaAte ?? null;
          }
        }
        await tx.fatura.update({ where: { id: f.id }, data: dados });
        if (t.status === "PAGA" && t.periodo) {
          avisar = "pago";
          await tx.conta.update({
            where: { id: f.contaId },
            data: {
              ...(f.conta.planoPendente === f.plano ? { planoPendente: null } : {}),
              ...(f.plano === "PILOTO" ? { pilotoInicio: agora } : {}),
              // compra paga: agora sim substitui cancelamento ou mudança agendados e o ciclo passa a ser o dela
              ...(!f.renovacao ? { renovacaoCancelada: false, mudancaAgendada: null, mudancaAgendadaEm: null, ciclo: f.ciclo ?? undefined } : {}),
            },
          });
        }
      }
      await sincronizarPlano(tx, f.contaId, agora);
      if (opts.eventoId) await tx.eventoCobranca.update({ where: { id: opts.eventoId }, data: { resultado: t.motivo, faturaId: f.id } });
      return { resultado: t.mudou ? ("processado" as const) : ("ignorado" as const), motivo: t.motivo, contaId: f.contaId, valor: f.valor.toString(), link: f.linkPagamento, avisar, carenciaAte, revisar: t.mudou && t.revisao ? f.id : null };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
  if ("revisar" in r && r.revisar) await avisarEquipeRevisao([r.revisar]);
  if ("avisar" in r && r.avisar) await avisarDonos(r.contaId, r.avisar, r.valor, r.link, r.carenciaAte);
  if ("avisar" in r && r.avisar === "pago") await registrarEvento("pagamento_confirmado", {});
  return r.resultado;
}

/**
 * Rotina de hora em hora (worker/cron): gera a renovação (mesmo atrasada, se a rotina ficou parada), aplica mudanças
 * agendadas, anda a régua de cobrança pelo calendário e encerra períodos vencidos. Idempotente.
 */
export async function renovarAssinaturas(agora = new Date()) {
  const resumo = { sincronizadas: 0, renovacoes: 0 };
  const limite = new Date(agora.getTime() + RENOVAR_DIAS_ANTES * 86_400_000);
  const candidatas = await db.conta.findMany({
    where: {
      demo: false,
      OR: [
        { planoVigenteAte: { lte: limite }, plano: { in: ["CARTEIRA", "ASSESSORIA"] } },
        { mudancaAgendadaEm: { lte: agora } },
        { situacaoCobranca: { in: ["ATRASADA", "CARENCIA"] } },
      ],
    },
    select: { id: true },
  });
  for (const { id: contaId } of candidatas) {
    const g = cobranca();
    const criada = await db.$transaction(async (tx) => {
      await travarConta(tx, contaId);
      const atual = await tx.conta.findUniqueOrThrow({ where: { id: contaId }, include: { membros: { where: { papel: "DONO" }, include: { usuario: true }, take: 1 } } });
      let fatura: FaturaDb | null = null;
      // renova antes de sincronizar: se a rotina atrasou, a renovação nasce já devida e a régua corre pelo calendário
      const precisa =
        !atual.renovacaoCancelada &&
        !!atual.planoVigenteAte &&
        (atual.plano === "CARTEIRA" || atual.plano === "ASSESSORIA") &&
        atual.planoVigenteAte.getTime() <= limite.getTime() &&
        !(atual.mudancaAgendada === "GRATIS");
      if (precisa) {
        const inicio = atual.planoVigenteAte!;
        const existe = await tx.fatura.findFirst({ where: { contaId, renovacao: true, periodoInicio: inicio, status: { not: "CANCELADA" } } });
        // compra (upgrade) aguardando pagamento: ela define o próximo período; renovar junto cobraria duas vezes
        const compra = await tx.fatura.findFirst({ where: { contaId, renovacao: false, status: "ABERTA", vencimento: { gte: agora } } });
        if (existe && !existe.gatewayId) fatura = await garantirCobrancaNoGateway(tx, existe.id, "ESCOLHER", atual.membros[0]?.usuario.email ?? ""); // cobrança que falhou antes
        else if (!existe && !compra) {
          const plano = atual.mudancaAgendada && atual.mudancaAgendada !== "GRATIS" ? atual.mudancaAgendada : atual.plano;
          const ciclo = (atual.ciclo === "ANUAL" ? "ANUAL" : "MENSAL") as Ciclo;
          const postos = await postosCobrados(tx, contaId);
          const valor = valorDoPlano(plano, { postos, ciclo });
          const nova = await tx.fatura.create({
            data: {
              contaId,
              referencia: inicio.toISOString().slice(0, 7),
              descricao: `Plano ${plano.toLowerCase()} (${ciclo === "ANUAL" ? "anual" : "mensal"}), renovação`,
              valor: valor.toFixed(2),
              postos,
              vencimento: inicio,
              plano,
              ciclo,
              periodoInicio: inicio,
              periodoFim: fimDoPeriodo(inicio, ciclo),
              renovacao: true,
            },
          });
          fatura = await garantirCobrancaNoGateway(tx, nova.id, "ESCOLHER", atual.membros[0]?.usuario.email ?? "");
        }
      }
      await sincronizarPlano(tx, contaId, agora);
      return fatura;
    }, TX_COM_GATEWAY).catch((e) => {
      // uma conta com o gateway fora do ar não impede as outras; a próxima rodada tenta de novo
      registrar("erro", "renovacao_falhou", { contaId, modo: g.modo, erro: e instanceof Error ? e.message : String(e) });
      return null;
    });
    resumo.sincronizadas++;
    if (criada) resumo.renovacoes++;
  }
  return resumo;
}

/** Resumo da assinatura para a tela de cobrança (valores sempre do servidor). */
export async function resumoAssinatura(contaId: string, agora = new Date()) {
  const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
  const faturas = await db.fatura.findMany({ where: { contaId }, orderBy: { criadoEm: "desc" }, take: 24 });
  const postos = await postosCobrados(db, contaId);
  const ciclo = (conta.ciclo === "ANUAL" ? "ANUAL" : "MENSAL") as Ciclo;
  const proxima = faturas.find((f) => (f.status === "ABERTA" || f.status === "FALHOU") && f.renovacao);
  const pendenteCompra = faturas.find((f) => f.status === "ABERTA" && !f.renovacao);
  const revisoes = faturas.filter((f) => f.revisao);
  return {
    conta,
    faturas,
    postos,
    ciclo,
    valorRenovacao: conta.plano === "CARTEIRA" || conta.plano === "ASSESSORIA" ? valorDoPlano(conta.mudancaAgendada && conta.mudancaAgendada !== "GRATIS" ? conta.mudancaAgendada : conta.plano, { postos, ciclo }).toFixed(2) : null,
    proxima,
    pendenteCompra,
    revisoes,
    devidaEmAberto: faturas.some((f) => faturaDevida(regra(f), agora)),
    totalEstornado: faturas.reduce((s, f) => s.plus(f.valorEstornado.toString()), new Decimal(0)).toFixed(2),
  };
}

async function avisarDonos(contaId: string, tipo: "pago" | "atrasada" | "carencia", valor: string, link: string | null, carenciaAte: Date | null) {
  const donos = await db.membro.findMany({ where: { contaId, papel: "DONO" }, include: { usuario: true } });
  const texto = {
    pago: `Recebemos o pagamento de ${reais(valor)}. Obrigado!`,
    atrasada: `O pagamento de ${reais(valor)} não foi identificado. Tentaremos de novo em 5 dias. Para pagar agora: ${link ?? appUrl("/app/configuracoes?aba=cobranca")}`,
    carencia: `Depois de 3 tentativas, o pagamento de ${reais(valor)} não foi identificado. A conta continua funcionando até ${carenciaAte?.toLocaleDateString("pt-BR", { timeZone: "UTC" })}; depois, fica só para consulta (nenhum dado é apagado). Para regularizar: ${appUrl("/app/configuracoes?aba=cobranca")}`,
  }[tipo];
  for (const d of donos)
    await enviar({ contaId, chave: `COBRANCA:${tipo}:${contaId}:${Date.now()}`, tipo: "COBRANCA", canal: "EMAIL", destino: d.usuario.email, assunto: "Equapar: cobrança", corpo: texto });
}

/** O que a equipe faz com cada fatura marcada para revisão (painel interno e e-mail). */
export const MOTIVO_REVISAO: Record<string, string> = {
  PAGA_APOS_CANCELAMENTO: "Pago depois do cancelamento: não reativou o plano. Devolver o valor ao cliente.",
  PAGAMENTO_DUPLICADO: "Pagamento em dobro do mesmo período: devolver o pagamento a mais.",
  ESTORNO_PARCIAL: "Estorno parcial feito no gateway: conferir o acordo com o cliente (o acesso foi mantido).",
  CHARGEBACK: "Contestação no cartão: responder no Asaas (o acesso segue até a decisão).",
  RENOVACAO_PAGA_SOBREPOSTA: "Renovação já paga ficou sobreposta a um upgrade: combinar devolução ou crédito com o cliente.",
};

const emailsDaEquipe = () => (process.env.PAINEL_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

/**
 * Avisa a equipe (PAINEL_EMAILS) que uma fatura foi marcada para revisão. Sem conta no aviso: não aparece na
 * central de avisos do cliente. Falha no envio não desfaz nada (a fatura continua listada no painel interno).
 */
async function avisarEquipeRevisao(faturaIds: string[]) {
  const para = emailsDaEquipe();
  if (!faturaIds.length || !para.length) return;
  const faturas = await db.fatura.findMany({ where: { id: { in: faturaIds }, revisao: { not: null } }, include: { conta: { select: { nome: true } } } });
  for (const f of faturas) {
    const corpo = [
      `Fatura marcada para revisão: ${MOTIVO_REVISAO[f.revisao!] ?? f.revisao}`,
      "",
      `Conta: ${f.conta.nome}`,
      `Fatura: ${f.descricao} · ${reais(f.valor.toFixed(2))}${f.valorEstornado.gt(0) ? ` · estornado ${reais(f.valorEstornado.toFixed(2))}` : ""}`,
      ...(f.gatewayId ? [`Cobrança no Asaas: ${f.gatewayId}`] : []),
      "",
      `Lista no painel interno: ${appUrl("/app/interno#revisoes")}`,
    ].join("\n");
    for (const destino of para)
      await enviar({ contaId: null, chave: `REVISAO:${f.id}:${f.revisao}:${Date.now()}`, tipo: "REVISAO_COBRANCA", canal: "EMAIL", destino, assunto: "Equapar: fatura para revisar", corpo }).catch((e) =>
        registrar("erro", "aviso_revisao_falhou", { faturaId: f.id, erro: e instanceof Error ? e.message : String(e) }),
      );
  }
}

/** Faturas marcadas e ainda não resolvidas, para o painel interno. */
export function faturasParaRevisar() {
  return db.fatura.findMany({
    where: { revisao: { not: null }, revisaoResolvidaEm: null },
    orderBy: { criadoEm: "asc" },
    take: 200,
    include: { conta: { select: { nome: true } } },
  });
}

/** Marca a revisão como tratada (devolução feita, acordo fechado). A marca `revisao` fica: ela define o acesso. */
export async function resolverRevisao(faturaId: string, quem: string, agora = new Date()) {
  const r = await db.fatura.updateMany({ where: { id: faturaId, revisao: { not: null }, revisaoResolvidaEm: null }, data: { revisaoResolvidaEm: agora, revisaoResolvidaPor: quem.slice(0, 120) } });
  return r.count === 1;
}
