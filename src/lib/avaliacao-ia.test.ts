import { describe, expect, it } from "vitest";
import gabarito from "../../fixtures/convencao-ficticia/gabarito.json";
import respostas from "../../fixtures/convencao-ficticia/respostas-simuladas.json";
import real from "../../fixtures/gabarito-convencoes.json";
import { avaliarLeitura, numeroClausula, paginasDoGabarito, podeLigar, resumo, type ConvencaoGabarito } from "./avaliacao-ia";

// E3: a avaliação conta acertos, erros e omissões e só libera a IA com gabarito conferido e sem erro de confiança alta.
describe("E3: avaliação da leitura de convenção", () => {
  it("convenção fictícia: 7 acertos, 2 erros (confiança baixa), 1 omissão; pode ligar", () => {
    const g = gabarito.convencoes[0] as ConvencaoGabarito;
    const itens = avaliarLeitura(g, respostas.ficticia as never);
    const r = resumo(itens, 2);
    expect(r).toMatchObject({ acertos: 7, erros: 2, omissoes: 1, errosComConfiancaAlta: 0 });
    expect(podeLigar(g.conferido, r.errosComConfiancaAlta)).toBe(true);
  });
  it("um erro com confiança alta impede ligar; gabarito não conferido também", () => {
    expect(podeLigar(true, 1)).toBe(false);
    expect(podeLigar(false, 0)).toBe(false);
    expect((real.convencoes as ConvencaoGabarito[]).every((c) => c.conferido === false)).toBe(true);
  });
  it("cláusula e páginas do gabarito", () => {
    expect(numeroClausula("3ª e nota 1")).toBe("3");
    expect(numeroClausula("Cláusula 16ª, § 3º, inciso V")).toBe("16");
    expect(paginasDoGabarito("9-10 e 12-13")).toEqual([9, 10, 12, 13]);
    expect(paginasDoGabarito("7 e 12")).toEqual([7, 12]);
  });
});
