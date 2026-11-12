import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  diasEntre,
  erroCnpj,
  exibirDinheiro,
  isoParaBr,
  mascaraCnpj,
  mascaraData,
  mascaraDinheiroDigitando,
  navegadorLegivel,
  parseData,
  parseDinheiro,
  parseInteiro,
  parsePercentual,
  plural,
  relativo,
} from "./mascaras";

describe("CNPJ", () => {
  it("aceita qualquer formato colado", () => {
    for (const v of ["11222333000181", "11.222.333/0001-81", "11 222 333 0001 81", " 11.222.333/0001-81 "]) {
      expect(mascaraCnpj(v)).toBe("11.222.333/0001-81");
      expect(cnpjValido(v)).toBe(true);
    }
  });
  it("máscara progressiva", () => {
    expect(mascaraCnpj("112")).toBe("11.2");
    expect(mascaraCnpj("11222333000")).toBe("11.222.333/000");
  });
  it("mensagens dizem o que fazer", () => {
    expect(erroCnpj("")).toBe("Digite o CNPJ da empresa.");
    expect(erroCnpj("1122")).toBe("Digite os 14 números do CNPJ.");
    expect(erroCnpj("11111111111111")).toBe("Esse CNPJ não existe. Confira os 14 números.");
    expect(erroCnpj("11222333000180")).toBe("Esse CNPJ não existe. Confira os 14 números.");
    expect(erroCnpj("11.222.333/0001-81")).toBeNull();
  });
});

describe("dinheiro", () => {
  it("aceita os formatos usuais e guarda em decimal exato", () => {
    expect(parseDinheiro("58.805,66")).toBe("58805.66");
    expect(parseDinheiro("58805,66")).toBe("58805.66");
    expect(parseDinheiro("58805.66")).toBe("58805.66");
    expect(parseDinheiro("R$ 58.805,66")).toBe("58805.66");
    expect(parseDinheiro("58.805")).toBe("58805.00");
    expect(parseDinheiro("1820,5")).toBe("1820.50");
    expect(parseDinheiro("0,1")).toBe("0.10");
    expect(parseDinheiro("-120,00")).toBe("-120.00");
  });
  it("recusa o que não é valor", () => {
    expect(parseDinheiro("")).toBeNull();
    expect(parseDinheiro("abc")).toBeNull();
    expect(parseDinheiro("1,234")).toBeNull();
    expect(parseDinheiro("12,34,5")).toBeNull();
  });
  it("exibe em pt-BR", () => {
    expect(exibirDinheiro("58805.66")).toBe("58.805,66");
    expect(exibirDinheiro("1234567.5")).toBe("1.234.567,50");
    expect(exibirDinheiro("-120.00")).toBe("-120,00");
    expect(exibirDinheiro(null)).toBe("");
  });
  it("máscara durante a digitação", () => {
    expect(mascaraDinheiroDigitando("58805")).toBe("58.805");
    expect(mascaraDinheiroDigitando("58805,6")).toBe("58.805,6");
    expect(mascaraDinheiroDigitando("58805,667")).toBe("58.805,66");
    expect(mascaraDinheiroDigitando("R$ 1a2")).toBe("12");
  });
});

describe("percentual", () => {
  it("aceita vírgula ou ponto e até 2 casas", () => {
    expect(parsePercentual("8,33")).toBe("8.33");
    expect(parsePercentual("8.33")).toBe("8.33");
    expect(parsePercentual("8,33%")).toBe("8.33");
    expect(parsePercentual("20")).toBe("20");
    expect(parsePercentual("8,333")).toBeNull();
    expect(parsePercentual("8,3333", 4)).toBe("8.3333");
    expect(parsePercentual("x")).toBeNull();
  });
});

describe("inteiro", () => {
  it("aceita separador de milhar e recusa decimais", () => {
    expect(parseInteiro("1.500")).toBe(1500);
    expect(parseInteiro("10")).toBe(10);
    expect(parseInteiro("10,5")).toBeNull();
    expect(parseInteiro("")).toBeNull();
  });
});

describe("data", () => {
  it("aceita dd/mm/aaaa, ano com 2 dígitos, sem barras e ISO", () => {
    expect(parseData("29/11/2026")).toBe("2026-11-29");
    expect(parseData("29/11/26")).toBe("2026-11-29");
    expect(parseData("29112026")).toBe("2026-11-29");
    expect(parseData("2026-11-29")).toBe("2026-11-29");
    expect(parseData("1/2/2027")).toBe("2027-02-01");
  });
  it("recusa datas que não existem", () => {
    expect(parseData("31/02/2026")).toBeNull();
    expect(parseData("29/02/2026")).toBeNull();
    expect(parseData("29/02/2028")).toBe("2028-02-29");
    expect(parseData("12/13/2026")).toBeNull();
    expect(parseData("")).toBeNull();
  });
  it("máscara e exibição", () => {
    expect(mascaraData("291120")).toBe("29/11/20");
    expect(mascaraData("29112026")).toBe("29/11/2026");
    expect(isoParaBr("2026-11-29")).toBe("29/11/2026");
  });
  it("relativo", () => {
    expect(diasEntre("2026-11-29", "2026-11-11")).toBe(18);
    expect(relativo(18)).toBe("em 18 dias");
    expect(relativo(1)).toBe("amanhã");
    expect(relativo(0)).toBe("hoje");
    expect(relativo(-3)).toBe("há 3 dias");
    expect(relativo(120)).toBe("em 4 meses");
    expect(relativo(30)).toBe("em 30 dias");
  });
});

describe("plural", () => {
  it("singular só com 1", () => {
    expect(plural(1, "cliente", "clientes")).toBe("1 cliente");
    expect(plural(0, "cliente", "clientes")).toBe("0 clientes");
    expect(plural(2, "contrato", "contratos")).toBe("2 contratos");
    expect(plural(1500, "posto", "postos")).toBe("1.500 postos");
    expect(plural(1, "mês", "meses", false)).toBe("mês");
  });
});

describe("navegador legível", () => {
  it("resume o user agent", () => {
    expect(navegadorLegivel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome no Windows");
    expect(navegadorLegivel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge no Windows");
    expect(navegadorLegivel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iPhone");
    expect(navegadorLegivel(null)).toBe("Navegador desconhecido");
  });
});
