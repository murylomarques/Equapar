/**
 * Máscaras e conversões puras (sem dependência de servidor), usadas pelos campos e testadas em mascaras.test.ts.
 * Regra (P7): aceitar o formato que a pessoa usar; guardar sempre em formato canônico.
 */

export function soDigitos(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

// ---------------------------------------------------------------- CNPJ
//
// B3. CNPJ numérico e alfanumérico (Receita Federal, a partir de 07/2026): letras e números nas 12 primeiras
// posições; os 2 dígitos verificadores continuam numéricos. Método oficial (Perguntas e respostas do CNPJ
// alfanumérico, pergunta 14): cada caractere vale o código ASCII menos 48 ("0" = 0 ... "9" = 9, "A" = 17 ...
// "Z" = 42); módulo 11 com pesos 5 4 3 2 9 8 7 6 5 4 3 2 (1º dígito) e 6 5 4 3 2 9 8 7 6 5 4 3 2 (2º dígito);
// resto 0 ou 1 dá dígito 0, senão 11 − resto. Para CNPJ só com números, o resultado é o mesmo de antes.

/** Forma canônica: maiúsculas, só letras e números ("12.abc.345/01de-35" → "12ABC34501DE35"). */
export function normalizarCnpj(v: string) {
  return (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Máscara progressiva 00.000.000/0000-00 (aceita letras nas 12 primeiras posições). */
export function mascaraCnpj(v: string) {
  const n = normalizarCnpj(v);
  // 12 primeiros: letras ou números; os 2 últimos: só números
  const d = (n.slice(0, 12) + n.slice(12).replace(/\D/g, "")).slice(0, 14);
  let s = d.slice(0, 2);
  if (d.length > 2) s += "." + d.slice(2, 5);
  if (d.length > 5) s += "." + d.slice(5, 8);
  if (d.length > 8) s += "/" + d.slice(8, 12);
  if (d.length > 12) s += "-" + d.slice(12, 14);
  return s;
}

/** Dígito verificador oficial (módulo 11 sobre ASCII − 48) para os primeiros 12 ou 13 caracteres. */
export function digitoCnpj(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const r = pesos.reduce((soma, p, i) => soma + (base.charCodeAt(i) - 48) * p, 0) % 11;
  return r < 2 ? 0 : 11 - r;
}

export function cnpjValido(v: string): boolean {
  const c = normalizarCnpj(v);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  return digitoCnpj(c.slice(0, 12)) === Number(c[12]) && digitoCnpj(c.slice(0, 13)) === Number(c[13]);
}

/** CNPJ com letras (o novo formato) */
export function cnpjAlfanumerico(v: string) {
  return /[A-Z]/.test(normalizarCnpj(v));
}

export function erroCnpj(v: string): string | null {
  const c = normalizarCnpj(v);
  if (!c) return "Digite o CNPJ da empresa.";
  if (c.length !== 14) return "Digite os 14 caracteres do CNPJ.";
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return "Os 2 últimos caracteres do CNPJ são números.";
  if (!cnpjValido(c)) return "Esse CNPJ não existe. Confira os 14 caracteres.";
  return null;
}

// ---------------------------------------------------------------- Dinheiro

/**
 * Converte o que a pessoa digitou em decimal canônico ("58805.66").
 * Aceita "58.805,66", "58805,66", "58805.66", "R$ 58.805,66", "58805". Inválido → null.
 * Nunca usa float: trabalha só com texto.
 */
export function parseDinheiro(v: string): string | null {
  let s = (v ?? "").replace(/R\$|\s/gi, "").trim();
  if (!s) return null;
  const neg = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.split(".");
  const inteiro = int.replace(/^0+(?=\d)/, "");
  return `${neg ? "-" : ""}${inteiro}.${(frac + "00").slice(0, 2)}`;
}

/** "58805.66" → "58.805,66" (sem "R$", para dentro do campo com prefixo). */
export function exibirDinheiro(canonico: string | null | undefined) {
  if (canonico == null || canonico === "") return "";
  const neg = canonico.startsWith("-");
  const [int, frac = "00"] = canonico.replace(/^-/, "").split(".");
  return `${neg ? "-" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${(frac + "00").slice(0, 2)}`;
}

/** Enquanto digita: só permite dígitos, um separador decimal e até 2 casas; insere pontos de milhar. */
export function mascaraDinheiroDigitando(v: string) {
  const limpo = (v ?? "").replace(/[^\d,]/g, "");
  const [int, ...resto] = limpo.split(",");
  const inteiro = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!resto.length) return inteiro;
  return `${inteiro || "0"},${resto.join("").slice(0, 2)}`;
}

// ---------------------------------------------------------------- Percentual

/** "8,33" | "8.33" | "8,33%" → "8.33". Até `casas` decimais. Inválido → null. */
export function parsePercentual(v: string, casas = 2): string | null {
  const s = (v ?? "").replace(/%|\s/g, "").replace(",", ".");
  if (!s) return null;
  const re = new RegExp(`^-?\\d{1,3}(\\.\\d{1,${casas}})?$`);
  return re.test(s) ? s : null;
}

export function exibirPercentual(canonico: string | null | undefined) {
  return canonico ? canonico.replace(".", ",") : "";
}

// ---------------------------------------------------------------- Inteiro

export function parseInteiro(v: string): number | null {
  const d = (v ?? "").replace(/[.\s]/g, "");
  return /^\d+$/.test(d) ? Number(d) : null;
}

// ---------------------------------------------------------------- Data

/** Máscara progressiva dd/mm/aaaa. */
export function mascaraData(v: string) {
  const d = soDigitos(v).slice(0, 8);
  let s = d.slice(0, 2);
  if (d.length > 2) s += "/" + d.slice(2, 4);
  if (d.length > 4) s += "/" + d.slice(4, 8);
  return s;
}

/**
 * "29/11/2026", "29/11/26", "29112026", "2026-11-29" → "2026-11-29". Data inexistente → null.
 * Ano com 2 dígitos vira 20aa.
 */
export function parseData(v: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  let dia: number, mes: number, ano: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) [ano, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else {
    const br = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/.exec(s);
    const junto = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(s);
    const m = br ?? junto;
    if (!m) return null;
    [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[3].length === 2) ano += 2000;
  }
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900 || ano > 2200) return null;
  const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > ult) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function isoParaBr(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Dias entre hoje (data local dada) e a data ISO. */
export function diasEntre(isoAlvo: string, isoHoje: string) {
  const a = Date.UTC(+isoAlvo.slice(0, 4), +isoAlvo.slice(5, 7) - 1, +isoAlvo.slice(8, 10));
  const h = Date.UTC(+isoHoje.slice(0, 4), +isoHoje.slice(5, 7) - 1, +isoHoje.slice(8, 10));
  return Math.round((a - h) / 86_400_000);
}

/** "hoje", "amanhã", "ontem", "em 18 dias", "há 3 dias", "em 4 meses" */
export function relativo(dias: number) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  const abs = Math.abs(dias);
  const txt = abs < 60 ? plural(abs, "dia", "dias") : plural(Math.round(abs / 30), "mês", "meses");
  return dias > 0 ? `em ${txt}` : `há ${txt}`;
}

/** 5.4: tempo até o fim da vigência, só com a data pública: "faltam 20 dias", "faltam 4 meses", "terminou". */
export function tempoAteFim(dias: number) {
  if (dias < 0) return "terminou";
  if (dias === 0) return "termina hoje";
  return `faltam ${dias < 60 ? plural(dias, "dia", "dias") : plural(Math.round(dias / 30), "mês", "meses")}`;
}

// ---------------------------------------------------------------- Texto

/** plural(1, "cliente", "clientes") → "1 cliente"; plural(0, ...) → "0 clientes". */
export function plural(n: number, singular: string, pluralForma: string, mostrarNumero = true) {
  const palavra = n === 1 || n === -1 ? singular : pluralForma;
  return mostrarNumero ? `${n.toLocaleString("pt-BR")} ${palavra}` : palavra;
}

/** "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/130 ... Edg/130" → "Edge no Windows" */
export function navegadorLegivel(ua: string | null | undefined) {
  const u = ua ?? "";
  if (!u) return "Navegador desconhecido";
  const nav = /Edg\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
      ? "Opera"
      : /Firefox\//.test(u)
        ? "Firefox"
        : /Chrome\//.test(u)
          ? "Chrome"
          : /Safari\//.test(u)
            ? "Safari"
            : "Navegador";
  const so = /Windows/.test(u)
    ? "Windows"
    : /iPhone|iPad/.test(u)
      ? "iPhone"
      : /Android/.test(u)
        ? "Android"
        : /Mac OS X|Macintosh/.test(u)
          ? "Mac"
          : /Linux/.test(u)
            ? "Linux"
            : "sistema desconhecido";
  return `${nav} no ${so}`;
}
