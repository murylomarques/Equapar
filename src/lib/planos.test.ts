import { afterEach, describe, expect, it, vi } from "vitest";
import { aplicarEvento, CARENCIA_DIAS, situacaoEfetiva, valorDoPlano } from "./planos";
import { precoJornada40 } from "./precos";

describe("4.2: preços", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("Carteira: R$ 4 por posto, mínimo R$ 297", () => {
    expect(valorDoPlano("CARTEIRA", { postos: 10, ciclo: "MENSAL" }).toFixed(2)).toBe("297.00");
    expect(valorDoPlano("CARTEIRA", { postos: 375, ciclo: "MENSAL" }).toFixed(2)).toBe("1500.00");
  });
  it("Assessoria R$ 1.497; Grátis e Piloto (por pedido) não têm mensalidade", () => {
    expect(valorDoPlano("ASSESSORIA", { postos: 0, ciclo: "MENSAL" }).toFixed(2)).toBe("1497.00");
    expect(valorDoPlano("GRATIS", { postos: 50, ciclo: "MENSAL" }).toFixed(2)).toBe("0.00");
    expect(valorDoPlano("PILOTO", { postos: 50, ciclo: "MENSAL" }).toFixed(2)).toBe("0.00");
  });
  it("anual = 12 meses pelo preço de 10 (configurável de 1 a 12; fora disso, 10)", () => {
    expect(valorDoPlano("CARTEIRA", { postos: 60, ciclo: "ANUAL" }).toFixed(2)).toBe("2970.00");
    expect(valorDoPlano("CARTEIRA", { postos: 200, ciclo: "ANUAL" }).toFixed(2)).toBe("8000.00");
    expect(valorDoPlano("ASSESSORIA", { postos: 0, ciclo: "ANUAL" }).toFixed(2)).toBe("14970.00");
    vi.stubEnv("MESES_PAGOS_ANUAL", "12");
    expect(valorDoPlano("CARTEIRA", { postos: 60, ciclo: "ANUAL" }).toFixed(2)).toBe("3564.00");
    for (const invalido of ["0", "13", "-5", "10.5", "abc"]) {
      vi.stubEnv("MESES_PAGOS_ANUAL", invalido);
      expect(valorDoPlano("CARTEIRA", { postos: 60, ciclo: "ANUAL" }).toFixed(2)).toBe("2970.00");
    }
  });
  it("Assessoria: R$ 1.497 até 1.500 postos somados; R$ 1 por posto acima", () => {
    expect(valorDoPlano("ASSESSORIA", { postos: 1500, ciclo: "MENSAL" }).toFixed(2)).toBe("1497.00");
    expect(valorDoPlano("ASSESSORIA", { postos: 1501, ciclo: "MENSAL" }).toFixed(2)).toBe("1498.00");
    expect(valorDoPlano("ASSESSORIA", { postos: 2000, ciclo: "MENSAL" }).toFixed(2)).toBe("1997.00");
  });
  it("Jornada 40h avulsa por faixa de postos do contrato", () => {
    expect(precoJornada40(1)).toBe(990);
    expect(precoJornada40(30)).toBe(990);
    expect(precoJornada40(31)).toBe(1990);
    expect(precoJornada40(100)).toBe(1990);
    expect(precoJornada40(101)).toBeNull();
  });
});

describe("4.2: pagamento que falha", () => {
  const agora = new Date("2026-11-13T12:00:00Z");
  const inicial = { faturaStatus: "ABERTA", tentativas: 0, situacao: "EM_DIA" as const, carenciaAte: null };
  it("1ª e 2ª falha: atrasada, nova tentativa em 5 dias, aviso", () => {
    const r = aplicarEvento(inicial, "VENCIDO", agora);
    expect(r).toMatchObject({ fatura: { status: "ABERTA", tentativas: 1 }, conta: { situacao: "ATRASADA" }, avisar: "atrasada" });
    expect(r.novaTentativaEm?.toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });
  it("3ª falha: carência de 15 dias; depois dela, somente leitura (sem apagar nada)", () => {
    const r = aplicarEvento({ ...inicial, tentativas: 2 }, "VENCIDO", agora);
    expect(r).toMatchObject({ fatura: { status: "FALHOU", tentativas: 3 }, conta: { situacao: "CARENCIA" }, avisar: "carencia" });
    expect(r.conta!.carenciaAte!.getTime() - agora.getTime()).toBe(CARENCIA_DIAS * 86_400_000);
    expect(situacaoEfetiva("CARENCIA", r.conta!.carenciaAte, new Date(agora.getTime() + 14 * 86_400_000))).toBe("CARENCIA");
    expect(situacaoEfetiva("CARENCIA", r.conta!.carenciaAte, new Date(agora.getTime() + 16 * 86_400_000))).toBe("SOMENTE_LEITURA");
  });
  it("pagamento confirmado: em dia e o plano escolhido passa a valer", () => {
    expect(aplicarEvento({ ...inicial, situacao: "CARENCIA" }, "PAGO", agora)).toMatchObject({ fatura: { status: "PAGA" }, conta: { situacao: "EM_DIA", carenciaAte: null }, aplicarPlano: true });
  });
});

import { limiteDoPlano } from "./planos";

describe("4.2: limites por plano (só com COBRANCA_EXIGIR_PLANO=true)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("desligado: ninguém é bloqueado", () => {
    vi.stubEnv("COBRANCA_EXIGIR_PLANO", "");
    expect(limiteDoPlano("GRATIS", { tipo: "gerar_pedido" })).toBeNull();
  });
  it("ligado: Grátis não gera pedido; Assessoria até o limite de clientes", () => {
    vi.stubEnv("COBRANCA_EXIGIR_PLANO", "true");
    vi.stubEnv("ASSESSORIA_MAX_CLIENTES", "2");
    expect(limiteDoPlano("GRATIS", { tipo: "gerar_pedido" })).toMatch(/Piloto ou da assinatura/);
    expect(limiteDoPlano("CARTEIRA", { tipo: "gerar_pedido" })).toBeNull();
    expect(limiteDoPlano("ASSESSORIA", { tipo: "adicionar_cliente", clientesAtuais: 1 })).toBeNull();
    expect(limiteDoPlano("ASSESSORIA", { tipo: "adicionar_cliente", clientesAtuais: 2 })).toMatch(/até 2 clientes/);
    expect(limiteDoPlano("CARTEIRA", { tipo: "adicionar_cliente", clientesAtuais: 0 })).toMatch(/Assessoria/);
  });
});
