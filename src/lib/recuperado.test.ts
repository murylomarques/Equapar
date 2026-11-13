import { describe, expect, it } from "vitest";
import { resumoRecuperado } from "./recuperado";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const c1 = { numero: "1/2025", orgao: "Órgão A" };
const c2 = { numero: "2/2025", orgao: "Órgão B" };

describe("5.2: Recuperado com a Equapar", () => {
  const r = resumoRecuperado([
    { contratoId: "a", contrato: c1, deferidoEm: d("2025-11-10"), valorDeferido: "1000.10", recebidoEm: d("2026-01-15"), valorRecebido: "1000.10" },
    { contratoId: "a", contrato: c1, deferidoEm: d("2026-06-01"), valorDeferido: "500.00", recebidoEm: null, valorRecebido: null },
    { contratoId: "b", contrato: c2, deferidoEm: d("2026-03-01"), valorDeferido: "250.25", recebidoEm: d("2026-05-01"), valorRecebido: "240.00" },
    { contratoId: "c", contrato: c2, deferidoEm: null, valorDeferido: null, recebidoEm: null, valorRecebido: null },
  ]);
  it("soma por ano: deferido pela data do deferimento, recebido pela data do recebimento", () => {
    expect(r.porAno.map((a) => [a.ano, a.deferido.toFixed(2), a.recebido.toFixed(2)])).toEqual([
      [2026, "750.25", "1240.10"],
      [2025, "1000.10", "0.00"],
    ]);
  });
  it("soma por contrato e ignora pedido sem valor registrado", () => {
    expect(r.porContrato.map((c) => [c.numero, c.deferido.toFixed(2), c.recebido.toFixed(2)])).toEqual([
      ["1/2025", "1500.10", "1000.10"],
      ["2/2025", "250.25", "240.00"],
    ]);
    expect(r.totalDeferido.toFixed(2)).toBe("1750.35");
    expect(r.totalRecebido.toFixed(2)).toBe("1240.10");
  });
});
