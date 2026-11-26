import { describe, expect, it } from "vitest";
import { agrupar, classificar, convencaoDaChave } from "./central-avisos";

// Central de avisos: os avisos da data-base da convenção (DB30, DB7, DB0) viram um evento por convenção e data-base.
const agora = new Date("2027-02-22T12:00:00Z");
const envio = (chave: string, tipo: string, enviadoEm = agora, canal = "EMAIL") => ({
  id: `${chave}-${canal}`,
  chave,
  tipo,
  contratoId: null,
  canal,
  destino: "dono@exemplo.local",
  status: "SIMULADO",
  erro: null,
  enviadoEm,
  corpo: "texto",
  assunto: "Assunto",
});
const conv = { id: "convexemplo0001", nome: "CCT Exemplo (fictícia)", mesDataBase: 3, dataDeposito: new Date("2026-03-10T00:00:00Z"), contratosAtivos: 2 };
const dados = (convencao: typeof conv | null) => ({ contrato: null, pedido: null, contaEmDia: true, convencao });

describe("central de avisos: data-base da convenção", () => {
  it("30 e 7 dias antes (e no dia) da mesma data-base viram um evento só, com o marco mais recente", () => {
    const db30 = envio("DB30:convexemplo0001:2027-03-01", "DB30", new Date("2027-01-30T12:00:00Z"));
    const ev = agrupar([db30, envio("DB7:convexemplo0001:2027-03-01", "DB7"), envio("DB7:convexemplo0001:2027-03-01", "DB7", agora, "WHATSAPP")]);
    expect(ev).toHaveLength(1);
    expect([ev[0].tipo, ev[0].convencaoId, ev[0].envios.length]).toEqual(["DB7", "convexemplo0001", 3]);
    // a data-base do ano seguinte é outro evento
    expect(agrupar([db30, envio("DB30:convexemplo0001:2028-03-01", "DB30")])).toHaveLength(2);
  });

  it("a convenção só sai da chave gerada pelo servidor, nos tipos da data-base", () => {
    expect(convencaoDaChave("DB7", "DB7:convexemplo0001:2027-03-01")).toBe("convexemplo0001");
    expect(convencaoDaChave("D7", "D7:convexemplo0001:2027-03-01")).toBeNull();
    expect(convencaoDaChave("DB7", "DB7:../admin:2027-03-01")).toBeNull();
  });

  it("antes da data-base: pendente, com urgência e atalho para a convenção", () => {
    const [ev] = agrupar([envio("DB7:convexemplo0001:2027-03-01", "DB7")]);
    const c = classificar(ev, dados(conv), agora);
    expect(c).toMatchObject({ categoria: "PRAZO", situacao: "PENDENTE", prioridade: "ALTA", acao: { rotulo: "Ver a convenção", href: "/app/convencoes#convencao-convexemplo0001" } });
    expect(c.titulo).toBe("CCT Exemplo (fictícia): data-base em 7 dias");
    expect(c.prazo).toEqual(new Date("2027-03-01T00:00:00Z"));
  });

  it("depois da data-base, sem a convenção nova registrada: continua pendente (ressalvar ou registrar)", () => {
    const [ev] = agrupar([envio("DB0:convexemplo0001:2027-03-01", "DB0")]);
    const c = classificar(ev, dados(conv), new Date("2027-03-20T12:00:00Z"));
    expect(c).toMatchObject({ situacao: "PENDENTE", titulo: "CCT Exemplo (fictícia): convenção nova ainda não registrada" });
    expect(c.resumo).toMatch(/ressalve o direito no termo aditivo/);
  });

  it("resolvido quando a convenção nova é registrada, quando a data-base muda ou quando não há contrato ativo", () => {
    const [ev] = agrupar([envio("DB0:convexemplo0001:2027-03-01", "DB0")]);
    const depois = new Date("2027-03-20T12:00:00Z");
    expect(classificar(ev, dados({ ...conv, dataDeposito: new Date("2027-03-15T00:00:00Z") }), depois)).toMatchObject({ situacao: "RESOLVIDO", acao: { href: "/app/hoje" } });
    expect(classificar(ev, dados({ ...conv, mesDataBase: 5 }), depois).titulo).toBe("CCT Exemplo (fictícia): data-base atualizada");
    expect(classificar(ev, dados({ ...conv, contratosAtivos: 0 }), depois).situacao).toBe("RESOLVIDO");
  });

  it("convenção que não é da conta (ou foi removida): informativo, sem link", () => {
    const [ev] = agrupar([envio("DB7:convexemplo0001:2027-03-01", "DB7")]);
    expect(classificar(ev, dados(null), agora)).toMatchObject({ situacao: "INFORMATIVO", acao: null });
  });
});
