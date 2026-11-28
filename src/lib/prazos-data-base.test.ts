import { describe, expect, it } from "vitest";
import { acoesDoContrato, convencaoRegistradaPara, marcoDataBase, oportunidade, prazosDoContrato, seloSituacao } from "./prazos";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("marcos do aviso da data-base (30 e 7 dias antes, e no dia)", () => {
  const conv = { mesDataBase: 3 }; // data-base em 01/03
  it("31 dias antes: nada; de 30 a 8 dias: DB30; de 7 a 1 dia: DB7", () => {
    expect(marcoDataBase(conv, d("2027-01-29"))).toBeNull(); // faltam 31 dias
    expect(marcoDataBase(conv, d("2027-01-30"))).toMatchObject({ marco: "DB30", dias: 30 });
    expect(marcoDataBase(conv, d("2027-02-21"))).toMatchObject({ marco: "DB30", dias: 8 });
    expect(marcoDataBase(conv, d("2027-02-22"))).toMatchObject({ marco: "DB7", dias: 7 });
    expect(marcoDataBase(conv, d("2027-02-28"))).toMatchObject({ marco: "DB7", dias: 1 });
    expect(marcoDataBase(conv, d("2027-02-28"))?.dataBase).toEqual(d("2027-03-01"));
  });
  it("no dia (com até 3 dias de folga se a rotina não rodou); depois disso, nada até o ano seguinte", () => {
    expect(marcoDataBase(conv, d("2027-03-01"))).toMatchObject({ marco: "DB0", dias: 0, dataBase: d("2027-03-01") });
    expect(marcoDataBase(conv, d("2027-03-04"))).toMatchObject({ marco: "DB0", dias: -3, dataBase: d("2027-03-01") });
    expect(marcoDataBase(conv, d("2027-03-05"))).toBeNull();
    expect(marcoDataBase(conv, d("2027-09-01"))).toBeNull();
  });
  it("data-base em janeiro: o aviso de dezembro aponta para o ano seguinte", () => {
    expect(marcoDataBase({ mesDataBase: 1 }, d("2026-12-25"))).toMatchObject({ marco: "DB7", dataBase: d("2027-01-01") });
  });
});

describe("Pedir até com a convenção nova pendente (mesma regra da Decisão de prorrogação)", () => {
  const hoje = d("2026-11-26");
  // data-base em 01/03/2026; proposta antes dela: há repactuação a pedir; vigência termina em 20/12/2026
  const contrato = (dataDeposito: Date | null) =>
    ({
      id: "k1",
      numero: "45/2025",
      orgao: "Prefeitura Municipal de Exemplo",
      vigenciaInicio: d("2025-01-02"),
      vigenciaFim: d("2026-12-20"),
      dataProposta: d("2024-12-01"),
      tipoReajuste: "REPACTUACAO",
      maoDeObraDedicada: true,
      convencao: { id: "cv1", nome: "CCT Exemplo (fictícia)", mesDataBase: 3, dataDeposito },
      pedidos: [],
    }) as never;

  it("registrada = depósito na data-base ou depois", () => {
    expect(convencaoRegistradaPara({ dataDeposito: d("2026-03-10") }, d("2026-03-01"))).toBe(true);
    expect(convencaoRegistradaPara({ dataDeposito: d("2025-03-10") }, d("2026-03-01"))).toBe(false);
    expect(convencaoRegistradaPara({ dataDeposito: null }, d("2026-03-01"))).toBe(false);
  });

  it("registrada: Pedir até o fim da vigência, com o botão de montar o pedido", () => {
    const c = contrato(d("2026-03-10"));
    expect(oportunidade(c, hoje)?.convencaoRegistrada).toBe(true);
    expect(seloSituacao(c, hoje).texto).toBe("Pedir até 20/12/2026");
    expect(prazosDoContrato(c, hoje).find((p) => p.tipo === "pedir")?.titulo).toBe("Data-limite para pedir a repactuação (antes da prorrogação)");
    expect(acoesDoContrato(c, hoje)[0]).toMatchObject({ titulo: "Pedir repactuação", botao: "Montar pedido" });
  });

  it("pendente: a mesma data, mas o que fazer é ressalvar o direito no aditivo antes de assinar", () => {
    const c = contrato(d("2025-03-10")); // depósito da convenção anterior
    expect(oportunidade(c, hoje)).toMatchObject({ convencaoRegistrada: false, pedirAte: d("2026-12-20") });
    expect(seloSituacao(c, hoje).texto).toBe("Ressalvar até 20/12/2026");
    const pedir = prazosDoContrato(c, hoje).find((p) => p.tipo === "pedir")!;
    expect(pedir.titulo).toMatch(/^Data-limite para ressalvar a repactuação no termo aditivo/);
    expect(pedir.regra?.fonte).toBe("AGU, Parecer JT-02/2009");
    expect(acoesDoContrato(c, hoje)[0]).toMatchObject({ titulo: "Ressalvar a repactuação no aditivo", botao: "Ver o que fazer", href: "/app/contratos/k1/prorrogacao" });
  });

  it("pendente com pedido aberto: continua o pedido", () => {
    const c = contrato(null) as unknown as { pedidos: unknown[] };
    c.pedidos = [{ id: "p1", estado: "EM_ANALISE", gatilho: "NOVA_CONVENCAO", dataBase: d("2026-03-01") }];
    expect(acoesDoContrato(c as never, hoje)[0]).toMatchObject({ titulo: "Pedir repactuação", botao: "Continuar pedido" });
  });
});
