import { describe, expect, it } from "vitest";
import { antes } from "../../prisma/seed-demo";
import { aplicarConfirmadas, filtrarSugestoes, fonteDaSugestao, linhasParaConvencao, normalizarNumero, paginaDaFonte } from "./sugestoes-convencao";

// 5.5: leitura da convenção com IA. A IA só sugere; entra na planilha só o que a pessoa confirmou.
const linhas = linhasParaConvencao(antes);

describe("5.5: sugestões da convenção", () => {
  it("manda para a IA as linhas fora do Módulo 6", () => {
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.every((l) => !l.modulo.startsWith("M6"))).toBe(true);
  });
  it("normaliza números e recusa o que não é número", () => {
    expect(normalizarNumero("1.820,00")).toBe("1820.00");
    expect(normalizarNumero("R$ 1820")).toBe("1820.00");
    expect(normalizarNumero("8,33%")).toBe("8.33");
    expect(normalizarNumero("mil e oitocentos")).toBeNull();
  });
  it("descarta sugestão de linha inexistente, número inválido e repetida", () => {
    const l = linhas[0];
    const base = { clausula: "4ª", pagina: 3, trecho: "piso", confianca: "alta" as const };
    const r = filtrarSugestoes(
      {
        observacoes: "",
        sugestoes: [
          { ...base, postoId: l.postoId, linhaId: l.linhaId, valorNovo: "1.900,00" },
          { ...base, postoId: l.postoId, linhaId: l.linhaId, valorNovo: "2000" },
          { ...base, postoId: "inventado", linhaId: l.linhaId, valorNovo: "1" },
          { ...base, postoId: l.postoId, linhaId: linhas[1].linhaId, valorNovo: "?" },
        ],
      },
      linhas,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valorNovo: "1900.00", valorAtual: l.valorAtual, descricao: l.descricao });
  });
  it("aplica só as confirmadas, com a cláusula e a página como fonte", () => {
    const l = linhas[0];
    const fonte = fonteDaSugestao("4ª", 3);
    expect(fonte).toBe("Cláusula 4ª, p. 3");
    expect(paginaDaFonte(fonte)).toBe(3);
    const { planilha, aplicadas } = aplicarConfirmadas(antes, [{ postoId: l.postoId, linhaId: l.linhaId, valor: "1900.00", fonte }]);
    expect(aplicadas).toBe(1);
    const nova = planilha.tipos.find((t) => t.id === l.postoId)!.linhas.find((x) => x.id === l.linhaId)!;
    expect(nova).toMatchObject({ valor: "1900.00", fonte });
    // a original não muda e as outras linhas ficam iguais
    expect(antes.tipos.find((t) => t.id === l.postoId)!.linhas.find((x) => x.id === l.linhaId)!.valor).toBe(l.valorAtual);
    expect(planilha.tipos.flatMap((t) => t.linhas).filter((x) => x.fonte === fonte)).toHaveLength(1);
  });
});
