/**
 * C5. Telefones brasileiros para o WhatsApp.
 * A Meta exige o número com o código do país (E.164). O cadastro aceita com ou sem 55 e com máscara.
 * O WhatsApp às vezes informa celulares sem o 9 depois do DDD; a comparação aceita as duas formas.
 */

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** "+55" + DDD + número, ou null se não for um telefone brasileiro válido. */
export function normalizarTelefoneBR(v: string | null | undefined): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!DDDS.has(Number(d.slice(0, 2)))) return null;
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== "9") return null; // celular com 9 dígitos começa por 9
  if (numero.length === 8 && !/^[2-9]/.test(numero)) return null;
  return `+55${d}`;
}

/** Chave de comparação: DDD + número, sem o 9 extra dos celulares. */
function chave(e164: string): string {
  const d = e164.slice(3); // tira +55
  const ddd = d.slice(0, 2);
  const n = d.slice(2);
  if (n.length === 9 && /^9[6-9]/.test(n)) return ddd + n.slice(1);
  return ddd + n;
}

/** Os dois números são o mesmo telefone (com ou sem 55, com ou sem o 9 depois do DDD)? */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarTelefoneBR(a);
  const nb = normalizarTelefoneBR(b);
  return !!na && !!nb && chave(na) === chave(nb);
}

/** Últimos 8 dígitos: comuns às formas com e sem o 9 (para filtrar no banco antes de comparar). */
export function finalTelefone(v: string): string {
  return v.replace(/\D/g, "").slice(-8);
}

const PALAVRAS_SAIR = new Set(["SAIR", "PARAR", "STOP"]);

/** "SAIR", "PARAR" ou "STOP", sem diferenciar maiúsculas, acentos e pontuação. */
export function ehPedidoParaSair(texto: string | null | undefined): boolean {
  const t = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return PALAVRAS_SAIR.has(t);
}
