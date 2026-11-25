import { describe, expect, it } from "vitest";
import { agrupar, classificar, ordenar, pedidoDaChave } from "./central-avisos";

const agora = new Date("2026-11-24T12:00:00Z");
const contrato = { id: "c45", numero: "45/2025", orgao: "Prefeitura Municipal de Exemplo", vigenciaFim: new Date("2026-12-01T00:00:00Z"), arquivado: false };
const envio = (chave: string, tipo: string, canal = "EMAIL", destino = "dono@exemplo.local", contratoId: string | null = "c45") => ({
  id: `${chave}-${canal}-${destino}`,
  chave,
  tipo,
  contratoId,
  canal,
  destino,
  status: "SIMULADO",
  erro: null,
  enviadoEm: agora,
  corpo: "texto da mensagem com https://site-qualquer.exemplo/link",
  assunto: "Assunto",
});

describe("Central de avisos: eventos de negócio, não mensagens", () => {
  it("o mesmo evento por e-mail e WhatsApp, para duas pessoas, vira uma ocorrência só", () => {
    const ev = agrupar([envio("D7:c45:2026-12-01", "D7"), envio("D7:c45:2026-12-01", "D7", "WHATSAPP"), envio("D7:c45:2026-12-01", "D7", "EMAIL", "gerente@exemplo.local")]);
    expect(ev).toHaveLength(1);
    expect(ev[0].envios).toHaveLength(3);
  });
  it("avisos de 30 e de 7 dias do mesmo fim de vigência viram um evento só (com o marco mais recente)", () => {
    const d30 = { ...envio("D30:c45:2026-12-01", "D30"), enviadoEm: new Date("2026-11-01T12:00:00Z") };
    const ev = agrupar([envio("D7:c45:2026-12-01", "D7"), envio("D7:c45:2026-12-01", "D7", "WHATSAPP"), d30]);
    expect(ev).toHaveLength(1);
    expect([ev[0].tipo, ev[0].chave, ev[0].envios.length]).toEqual(["D7", "D7:c45:2026-12-01", 3]);
    // vigência diferente (contrato prorrogado) continua sendo outro evento
    expect(agrupar([envio("D7:c45:2026-12-01", "D7"), envio("D30:c45:2027-12-01", "D30")])).toHaveLength(2);
    // ordem de chegada não importa: o D7 mais novo vence mesmo vindo depois
    const inverso = agrupar([d30, envio("D7:c45:2026-12-01", "D7")]);
    expect([inverso.length, inverso[0].tipo]).toEqual([1, "D7"]);
  });
  it("pedidoId só sai da chave gerada pelo servidor, nos tipos de pedido", () => {
    expect(pedidoDaChave("DEFERIDO", "DEFERIDO:cmwulp5mu00286ffo52zkjxxp")).toBe("cmwulp5mu00286ffo52zkjxxp");
    expect(pedidoDaChave("D7", "D7:c45:2026-12-01")).toBeNull();
    expect(pedidoDaChave("DEFERIDO", "DEFERIDO:../../admin")).toBeNull();
  });
});

describe("Central de avisos: o que aconteceu, urgência e onde resolver", () => {
  const [d7] = agrupar([envio("D7:c45:2026-12-01", "D7")]);
  it("prazo próximo: contrato, urgência, data e atalho para os prazos do contrato certo", () => {
    const c = classificar(d7, { contrato, pedido: null, contaEmDia: true }, agora);
    expect(c).toMatchObject({ categoria: "PRAZO", situacao: "PENDENTE", prioridade: "ALTA", acao: { href: "/app/contratos/c45?aba=prazos" } });
    expect(c.titulo).toBe("Contrato 45/2025: fim da vigência em 7 dias");
    expect(c.objeto).toContain("Prefeitura Municipal de Exemplo");
  });
  it("vigência atualizada (prorrogada) ou contrato arquivado: resolvido", () => {
    expect(classificar(d7, { contrato: { ...contrato, vigenciaFim: new Date("2027-12-01T00:00:00Z") }, pedido: null, contaEmDia: true }, agora).situacao).toBe("RESOLVIDO");
    expect(classificar(d7, { contrato: { ...contrato, arquivado: true }, pedido: null, contaEmDia: true }, agora).situacao).toBe("RESOLVIDO");
  });
  it("contrato que não é da conta (ou foi removido): sem link nenhum", () => {
    expect(classificar(d7, { contrato: null, pedido: null, contaEmDia: true }, agora).acao).toBeNull();
  });
  it("deferido: leva ao pedido certo com o próximo passo financeiro, até receber", () => {
    const [ev] = agrupar([envio("DEFERIDO:pedido0000000001", "DEFERIDO")]);
    const base = { id: "pedido0000000001", contratoId: "c45", apostiladoEm: null };
    expect(classificar(ev, { contrato, pedido: { ...base, estado: "DEFERIDO" }, contaEmDia: true })).toMatchObject({ situacao: "PENDENTE", prioridade: "ALTA", acao: { rotulo: "Registrar o apostilamento", href: "/app/pedidos/pedido0000000001/pronto" } });
    expect(classificar(ev, { contrato, pedido: { ...base, estado: "DEFERIDO", apostiladoEm: agora }, contaEmDia: true }).acao?.rotulo).toBe("Registrar nota fiscal");
    expect(classificar(ev, { contrato, pedido: { ...base, estado: "FATURADO" }, contaEmDia: true }).acao?.rotulo).toBe("Registrar recebimento");
    expect(classificar(ev, { contrato, pedido: { ...base, estado: "RECEBIDO" }, contaEmDia: true }).situacao).toBe("RESOLVIDO");
    expect(classificar(ev, { contrato, pedido: null, contaEmDia: true }).acao).toBeNull();
  });
  it("cobrança: pendente só enquanto a conta não estiver em dia", () => {
    const [ev] = agrupar([envio("COBRANCA:atrasada:conta:1", "COBRANCA", "EMAIL", "dono@exemplo.local", null)]);
    expect(classificar(ev, { contrato: null, pedido: null, contaEmDia: false })).toMatchObject({ situacao: "PENDENTE", acao: { href: "/app/configuracoes?aba=cobranca" } });
    expect(classificar(ev, { contrato: null, pedido: null, contaEmDia: true }).situacao).toBe("RESOLVIDO");
  });
  it("o link nunca vem do texto da mensagem", () => {
    const c = classificar(d7, { contrato, pedido: null, contaEmDia: true }, agora);
    expect(c.acao?.href.startsWith("/app/")).toBe(true);
    expect(JSON.stringify(c)).not.toContain("site-qualquer");
  });
  it("pendentes e urgentes primeiro", () => {
    const [d60] = agrupar([envio("D60:c19:2027-01-20", "D60", "EMAIL", "x", "c19")]);
    const c19 = { ...contrato, id: "c19", numero: "19/2025", vigenciaFim: new Date("2027-01-20T00:00:00Z") };
    const xs = ordenar([
      { ev: d60, c: classificar(d60, { contrato: c19, pedido: null, contaEmDia: true }, agora) },
      { ev: d7, c: classificar(d7, { contrato, pedido: null, contaEmDia: true }, agora) },
    ]);
    expect(xs.map((x) => x.c.prioridade)).toEqual(["ALTA", "BAIXA"]);
  });
});
