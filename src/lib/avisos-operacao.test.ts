import { afterEach, describe, expect, it, vi } from "vitest";
import { avisosOperacao } from "./avisos-operacao";
import { VARIAVEIS_SITE } from "./site";

// B6/G6: em produção, avisa o que falta (só nomes); fora de produção, nada.
describe("B6: avisos de operação", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("produção sem dados: avisa dados da empresa e e-mail, sem valores", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const k of [...VARIAVEIS_SITE, "SMTP_URL", "EMAIL_FROM"]) vi.stubEnv(k, "");
    const a = avisosOperacao();
    expect(a.map((x) => x.codigo)).toEqual(["dados_empresa_incompletos", "email_nao_configurado"]);
    expect(a[0].detalhe).toContain("SITE_CNPJ");
  });
  it("tudo preenchido: sem avisos; fora de produção: sem avisos", () => {
    vi.stubEnv("NODE_ENV", "production");
    const v: Record<string, string> = { SITE_EMAIL_CONTATO: "contato@exemplo.local", SITE_WHATSAPP: "5511900000000", SITE_FUNDADOR_NOME: "Pessoa Exemplo", SITE_FUNDADOR_FOTO: "/foto.jpg", SITE_RAZAO_SOCIAL: "Empresa Exemplo Ltda.", SITE_CNPJ: "11222333000181", SITE_ENDERECO: "Rua Exemplo, 1", SITE_CIDADE: "Cidade/UF", SMTP_URL: "smtp://exemplo.local", EMAIL_FROM: "x <x@exemplo.local>" };
    for (const [k, val] of Object.entries(v)) vi.stubEnv(k, val);
    expect(avisosOperacao()).toEqual([]);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_CNPJ", "");
    expect(avisosOperacao()).toEqual([]);
  });
});
