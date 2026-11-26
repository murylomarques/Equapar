import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

// Segurança (verificação estrutural): toda ação de servidor confere quem está pedindo, no servidor.
// Uma ação nova sem guarda faz este teste falhar; as públicas de propósito ficam listadas abaixo, com o motivo.
const GUARDAS = /exigir\(|exigirUsuario\(|pedidoEditavel\(|pedidoDaConta\(|contratoDaConta\(|donoDoPainel\(|contexto\(/;
const PUBLICAS: Record<string, string> = {
  "src/app/(auth)/acoes.ts:entrar": "login",
  "src/app/(auth)/acoes.ts:confirmar2fa": "segunda etapa do login (usa a sessão pendente)",
  "src/app/(auth)/acoes.ts:criarConta": "cadastro (captcha)",
  "src/app/(auth)/acoes.ts:completarEmpresa": "cadastro (usa a sessão recém-criada)",
  "src/app/(auth)/acoes.ts:sair": "encerra a própria sessão",
  "src/app/(auth)/acoes.ts:pedirRedefinicao": "recuperação de senha (cotas por e-mail e IP)",
  "src/app/(auth)/acoes.ts:redefinirSenha": "recuperação de senha (token de uso único)",
  "src/app/(auth)/acoes.ts:aceitarConvite": "convite (token de uso único)",
  "src/app/(site)/demonstracao/acoes.ts:entrarNaDemonstracao": "demonstração (cota por IP e limite global)",
  "src/app/(site)/raio-x/acoes.ts:pedirRelatorio": "Raio-X público (cotas por e-mail e IP)",
  "src/app/(site)/raio-x/acoes.ts:avisarDepois": "Raio-X público (cotas por e-mail e IP)",
  "src/app/app/acoes.ts:onboardingImportar": "delega para importarPncp, que exige editar_contratos",
};

function acoesDeServidor() {
  const arquivos = execFileSync("git", ["grep", "-l", '"use server"', "--", "src"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  return arquivos.flatMap((f) => {
    const s = fs.readFileSync(f, "utf8");
    const nomes = [...s.matchAll(/export async function (\w+)\(/g)];
    return nomes.map((m, i) => ({ chave: `${f}:${m[1]}`, corpo: s.slice(m.index!, nomes[i + 1]?.index ?? s.length) }));
  });
}

describe("Segurança: ações de servidor", () => {
  it("toda ação confere permissão no servidor, salvo as públicas listadas com motivo", () => {
    const acoes = acoesDeServidor();
    expect(acoes.length).toBeGreaterThan(50);
    const semGuarda = acoes.filter((a) => !GUARDAS.test(a.corpo) && !PUBLICAS[a.chave]).map((a) => a.chave);
    expect(semGuarda).toEqual([]);
  });
  it("a ação delegada continua protegida", () => {
    const s = fs.readFileSync("src/app/app/acoes.ts", "utf8");
    const corpo = s.slice(s.indexOf("export async function importarPncp"), s.indexOf("export async function", s.indexOf("export async function importarPncp") + 10));
    expect(corpo).toMatch(/exigir\("editar_contratos"\)/);
  });
  it("cada papel só tem as ações do seu nível (Leitura só vê)", async () => {
    const { pode } = await import("./auth-papeis");
    expect(pode("LEITURA", "editar_pedidos")).toBe(false);
    expect(pode("LEITURA", "registrar_financeiro")).toBe(false);
    expect(pode("LEITURA", "gerenciar_conta")).toBe(false);
    expect(pode("CONTADOR", "registrar_financeiro")).toBe(false);
    expect(pode("CONTADOR", "aprovar_memoria")).toBe(true);
    expect(pode("GERENTE", "gerenciar_conta")).toBe(false);
    expect(pode("GERENTE", "aprovar_memoria")).toBe(false);
    expect(pode("DONO", "gerenciar_conta")).toBe(true);
  });
});
