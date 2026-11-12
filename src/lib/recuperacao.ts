/**
 * C8. Códigos de recuperação das duas etapas: 10 códigos mostrados uma única vez.
 * No banco ficam só os hashes (SHA-256); cada código vale uma vez.
 */
import crypto from "node:crypto";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I

function hash(codigo: string) {
  return crypto.createHash("sha256").update(normalizar(codigo)).digest("hex");
}

function normalizar(codigo: string) {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function gerarCodigosRecuperacao(n = 10): { codigos: string[]; hashes: string[] } {
  const codigos = Array.from({ length: n }, () => {
    const b = crypto.randomBytes(10);
    const s = Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
    return `${s.slice(0, 5)}-${s.slice(5, 10)}`;
  });
  return { codigos, hashes: codigos.map(hash) };
}

/** Se o código é um dos códigos de recuperação, devolve a lista sem ele (para gravar); senão, null. */
export function usarCodigoRecuperacao(codigo: string, hashes: string[]): string[] | null {
  if (normalizar(codigo).length !== 10) return null;
  const h = hash(codigo);
  return hashes.includes(h) ? hashes.filter((x) => x !== h) : null;
}
