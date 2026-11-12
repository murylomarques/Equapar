import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// L13: a tela do Raio-X só mostra estados reais. Antes havia "etapas" com setTimeout de 350 e 700 ms
// depois que a resposta já tinha chegado.
describe("L13: Raio-X sem etapas encenadas", () => {
  it("resultado.tsx não usa setTimeout para mudar de etapa", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "resultado.tsx"), "utf8");
    expect(fonte).not.toMatch(/setTimeout/);
    expect(fonte).not.toMatch(/fase: "lendo"/);
  });
});
