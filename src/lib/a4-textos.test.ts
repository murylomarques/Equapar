import { afterEach, describe, expect, it, vi } from "vitest";
import { valorDoPlano } from "./planos";
import { canaisDeAviso } from "./site";
import { EXEMPLO, valorResumoExemplo } from "./exemplo-demo";
import { reaisResumo } from "./format";

// A4: o site não promete o que não existe e mostra os mesmos números da demonstração.
describe("A4: textos e números do site", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("Carteira: 74 postos = R$ 297 (mínimo); 75 postos = R$ 300", () => {
    expect(valorDoPlano("CARTEIRA", { postos: 74, ciclo: "MENSAL" }).toFixed(2)).toBe("297.00");
    expect(valorDoPlano("CARTEIRA", { postos: 75, ciclo: "MENSAL" }).toFixed(2)).toBe("300.00");
  });
  it("WhatsApp só aparece com WHATSAPP_TOKEN", () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(canaisDeAviso()).toBe("Avisos por e-mail");
    vi.stubEnv("WHATSAPP_TOKEN", "token-ficticio");
    expect(canaisDeAviso()).toBe("Avisos por e-mail e WhatsApp");
  });
  it("prévia e demonstração usam o mesmo valor a receber", () => {
    expect(valorResumoExemplo()).toBe(reaisResumo(EXEMPLO.deferido.valor));
    expect(valorResumoExemplo()).toBe("R$ 31,5 mil");
  });
});
