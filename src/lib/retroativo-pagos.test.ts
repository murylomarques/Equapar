import { describe, expect, it } from "vitest";
import { antes, agora } from "../../prisma/seed-demo";
import { calcularPedido } from "./pedido";
import { hashCalculo } from "./pedido-regras";

// C6: valores já pagos e "regra do caso em análise". Com os campos novos vazios, tudo igual (trava 3).
const base = { planilhaAntes: antes as never, planilhaAgora: agora as never, dataBase: new Date(Date.UTC(2026, 0, 1)), dataReferencia: new Date(Date.UTC(2026, 10, 12)) };

describe("C6: retroativo com valores já pagos", () => {
  it("campos novos vazios: o mesmo R$ 33.951,94 do caso de exemplo", () => {
    const c = calcularPedido(base);
    expect(c.retroativo?.total).toBe("33951.94");
    expect(calcularPedido({ ...base, valoresJaPagos: "0" as never }).retroativo?.total).toBe("33951.94");
    expect(c.jaPago).toBeNull();
    expect(c.comparacaoMes).toBeNull();
  });
  it("desconta o já pago e mostra o bruto", () => {
    const c = calcularPedido({ ...base, valoresJaPagos: "1951.94" as never });
    expect(c.retroativo?.total).toBe("32000.00");
    expect(c.retroativoBruto).toBe("33951.94");
    expect(c.jaPago).toBe("1951.94");
  });
  it("regra do caso em análise: dias corridos e mês de 30 dias lado a lado; o pedido usa o escolhido", () => {
    const c = calcularPedido({ ...base, retroCompararMes: true, retroMesIncompleto: "MES_30_DIAS" });
    expect(c.comparacaoMes?.DIAS_CORRIDOS).toBe("33951.94");
    expect(c.comparacaoMes?.MES_30_DIAS).toBe(c.retroativo?.total);
  });
  it("a assinatura do cálculo não muda com os campos vazios e muda com valor pago", () => {
    const h = hashCalculo(base as never);
    expect(hashCalculo({ ...base, valoresJaPagos: "0" } as never)).toBe(h);
    expect(hashCalculo({ ...base, valoresJaPagos: "10" } as never)).not.toBe(h);
  });
});
