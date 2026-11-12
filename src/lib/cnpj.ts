import { cnpjValido, mascaraCnpj, soDigitos } from "./mascaras";

export { cnpjValido, soDigitos };

export function formatarCnpj(v: string) {
  return mascaraCnpj(soDigitos(v).padStart(14, "0"));
}
