/**
 * S10. Regras de senha do NIST SP 800-63B: sem regra de composição (nada de "letras e números"),
 * tamanho mínimo, até 64 caracteres, e recusa de senhas comuns ou fáceis de adivinhar. Sem troca periódica.
 * A lista é local (nenhum serviço externo recebe a senha).
 */

export const SENHA_MIN = 15;
export const SENHA_MIN_DUAS_ETAPAS = 8;
export const SENHA_MAX = 64;

// Senhas e raízes mais comuns em vazamentos (inclui variações em português). Comparação sem maiúsculas,
// sem acentos e sem números/símbolos nas pontas.
const COMUNS = new Set([
  "password", "senha", "123456", "qwerty", "abc123", "iloveyou", "admin", "welcome", "letmein", "monkey", "dragon", "football",
  "baseball", "sunshine", "princess", "master", "shadow", "superman", "trustno1", "batman", "passw0rd", "starwars", "hello",
  "freedom", "whatever", "qazwsx", "mudar", "mudarsenha", "trocar", "brasil", "flamengo", "corinthians", "palmeiras", "saopaulo",
  "vasco", "gremio", "cruzeiro", "santos", "botafogo", "fluminense", "internacional", "atletico", "jesus", "deus", "amor",
  "teamo", "familia", "equapar", "empresa", "limpeza", "contrato", "repactuacao", "governo", "prefeitura", "acesso", "entrar",
  "login", "usuario", "teste", "test", "segredo", "minhasenha", "suasenha", "novasenha", "asdfgh", "zxcvbn", "qwertyuiop",
]);

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Repetição (aaaa, abcabc) ou sequência (1234…, abcd…) que cobre a senha inteira. */
function trivial(s: string) {
  const t = normalizar(s).replace(/\s+/g, "");
  if (new Set(t).size <= 2) return true;
  for (let n = 1; n <= t.length / 2; n++) if (t === t.slice(0, n).repeat(Math.ceil(t.length / n)).slice(0, t.length)) return true;
  const seq = (passo: number) => [...t].every((c, i) => i === 0 || c.charCodeAt(0) - t.charCodeAt(i - 1) === passo);
  // dígitos em sequência "dão a volta" (…7890123…)
  const digitos = /^[0-9]+$/.test(t) && [...t].every((c, i) => i === 0 || (Number(c) - Number(t[i - 1]) + 10) % 10 === 1);
  return seq(1) || seq(-1) || digitos;
}

/** Também pega "comum + números/símbolos" (Password123…, senhasenhasenha1). */
function comum(s: string) {
  const t = normalizar(s).replace(/[^a-z0-9]/g, "");
  const nucleo = t.replace(/^[0-9]+|[0-9]+$/g, "");
  if (COMUNS.has(t) || COMUNS.has(nucleo)) return true;
  for (const c of COMUNS) if (nucleo && c.length >= 4 && nucleo.replaceAll(c, "") === "") return true;
  return /^[0-9]+$/.test(t) && trivial(t.slice(0, 10));
}

export function senhaFraca(senha: string, opts: { duasEtapas?: boolean; email?: string | null } = {}): string | null {
  const min = opts.duasEtapas ? SENHA_MIN_DUAS_ETAPAS : SENHA_MIN;
  if (senha.length < min) return `A senha precisa ter pelo menos ${min} caracteres. Uma frase fácil de lembrar serve.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter até ${SENHA_MAX} caracteres.`;
  if (trivial(senha) || comum(senha)) return "Essa senha é comum ou fácil de adivinhar. Escolha outra, por exemplo uma frase.";
  const local = normalizar(opts.email?.split("@")[0] ?? "").replace(/[^a-z0-9]/g, "");
  if (local.length >= 4 && normalizar(senha).replace(/[^a-z0-9]/g, "").includes(local)) return "A senha não pode conter o seu e-mail.";
  return null;
}
