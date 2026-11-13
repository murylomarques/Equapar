import { describe, expect, it } from "vitest";
import { mostrarDica } from "./dicas";

describe("5.4: dicas do primeiro pedido", () => {
  it("aparece no primeiro pedido da conta", () => {
    expect(mostrarDica(3, 0, null)).toBe(true);
  });
  it("dispensada, não volta", () => {
    expect(mostrarDica(3, 0, ["passo3"])).toBe(false);
    expect(mostrarDica(2, 0, ["passo3"])).toBe(true);
  });
  it("depois do primeiro pedido gerado, some", () => {
    expect(mostrarDica(1, 1, null)).toBe(false);
  });
});
