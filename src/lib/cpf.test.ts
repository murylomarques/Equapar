import { describe, expect, it } from "vitest";
import { contarCpfs, cpfValido } from "./cpf";

// E2: CPF FICTÍCIO gerado pelo algoritmo dentro do teste (trava 7); nunca copiado de lugar nenhum.
function gerarCpf(base: string) {
  const d = base.split("").map(Number);
  for (const n of [9, 10]) {
    const soma = d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0);
    const r = (soma * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join("");
}

describe("E2: CPF no texto antes da IA", () => {
  const cpf = gerarCpf("123456789");
  const mascarado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  it("valida o CPF gerado e recusa dígito errado e repetido", () => {
    expect(cpfValido(cpf)).toBe(true);
    expect(cpfValido(cpf.slice(0, 10) + ((Number(cpf[10]) + 1) % 10))).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
  it("acha CPF com e sem máscara; ignora números que não são CPF", () => {
    expect(contarCpfs(`Empregado Fulano Exemplo, CPF ${mascarado}, salário 1.820,00`)).toBe(1);
    expect(contarCpfs(`linha ${cpf} fim`)).toBe(1);
    expect(contarCpfs("Salário base 1820,00; CNPJ 11.222.333/0001-81; total 58805,66")).toBe(0);
    expect(contarCpfs(`código 9${cpf}9`)).toBe(0);
  });
});
