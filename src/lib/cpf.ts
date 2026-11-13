/**
 * E2. CPF dentro de um texto (11 dígitos com dígito verificador válido, com ou sem máscara).
 * Usado para NÃO enviar à IA um arquivo que parece ter dados de pessoas (folha com nomes e CPFs).
 */
export function cpfValido(v: string): boolean {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    const soma = [...d.slice(0, n)].reduce((s, c, i) => s + Number(c) * (n + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Quantos CPFs válidos aparecem no texto (000.000.000-00 ou 00000000000, sem colar em outros dígitos). */
export function contarCpfs(texto: string): number {
  const achados = (texto ?? "").match(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g) ?? [];
  return achados.filter(cpfValido).length;
}

export const MENSAGEM_CPF = "Este arquivo parece ter CPF de pessoas. Tire nomes e CPFs ou digite os valores à mão.";
