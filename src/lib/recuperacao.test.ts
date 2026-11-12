import { describe, expect, it } from "vitest";
import { gerarCodigosRecuperacao, usarCodigoRecuperacao } from "./recuperacao";

describe("C8: códigos de recuperação", () => {
  it("gera 10 códigos distintos, e o banco guarda só os hashes", () => {
    const { codigos, hashes } = gerarCodigosRecuperacao();
    expect(new Set(codigos).size).toBe(10);
    expect(codigos[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(hashes.some((h) => codigos.includes(h))).toBe(false);
  });
  it("cada código vale uma vez, sem diferenciar maiúsculas e hífen", () => {
    const { codigos, hashes } = gerarCodigosRecuperacao();
    const resto = usarCodigoRecuperacao(codigos[3].toLowerCase().replace("-", ""), hashes);
    expect(resto).toHaveLength(9);
    expect(usarCodigoRecuperacao(codigos[3], resto!)).toBeNull();
    expect(usarCodigoRecuperacao("123456", hashes)).toBeNull();
  });
});
