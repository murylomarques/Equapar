import { cnpjAlfanumerico, cnpjValido, mascaraCnpj, normalizarCnpj, soDigitos } from "./mascaras";

export { cnpjAlfanumerico, cnpjValido, normalizarCnpj, soDigitos };

/** 00.000.000/0000-00 (numérico com zeros à esquerda completados, como antes; alfanumérico como está). */
export function formatarCnpj(v: string) {
  const n = normalizarCnpj(v);
  return mascaraCnpj(/^\d+$/.test(n) ? n.padStart(14, "0") : n);
}
