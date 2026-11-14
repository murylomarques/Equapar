import { afterEach, describe, expect, it, vi } from "vitest";
import { agentePncp, camposFaltando, contatoSite, dadosEmpresa, identificacaoEmpresa, remetentePadrao, telefoneFormatado, VARIAVEIS_SITE } from "./site";

// B1/B4/B5/B6: dados da empresa só pelo ambiente. Valores FICTÍCIOS (trava 11).
const limpar = () => {
  for (const k of [...VARIAVEIS_SITE, "SITE_AGENDA_URL"]) vi.stubEnv(k, "");
};
describe("B1: dados da empresa pelo ambiente", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("tudo vazio: empresa em constituição, sem CNPJ, sem WhatsApp, e-mail padrão", () => {
    limpar();
    const e = dadosEmpresa();
    expect(e.razaoSocial).toBe("Equapar (empresa em constituição)");
    expect(e.cnpj).toBeNull();
    expect(e.local).toBeNull();
    expect(contatoSite()).toMatchObject({ email: "contato@equapar.com", whatsappLink: null, agendaUrl: null });
    expect(camposFaltando()).toEqual([...VARIAVEIS_SITE]);
  });
  it("sem endereço, mostra só a cidade", () => {
    limpar();
    vi.stubEnv("SITE_CIDADE", "Cidade Exemplo/UF");
    expect(dadosEmpresa().local).toBe("Cidade Exemplo/UF");
  });
  it("CNPJ válido (numérico ou alfanumérico) aparece formatado; inválido não aparece e conta como faltando", () => {
    limpar();
    vi.stubEnv("SITE_CNPJ", "12abc34501de35");
    vi.stubEnv("SITE_RAZAO_SOCIAL", "Empresa Exemplo Ltda.");
    expect(dadosEmpresa()).toMatchObject({ cnpj: "12.ABC.345/01DE-35", razaoSocial: "Empresa Exemplo Ltda.", emConstituicao: false });
    vi.stubEnv("SITE_CNPJ", "12ABC34501DE36");
    expect(dadosEmpresa()).toMatchObject({ cnpj: null, cnpjInvalido: true });
    expect(camposFaltando()).toContain("SITE_CNPJ");
  });
  it("B4: WhatsApp só com dígitos, link wa.me com a mensagem; telefone formatado", () => {
    limpar();
    vi.stubEnv("SITE_WHATSAPP", "+55 (11) 90000-0000");
    const c = contatoSite();
    expect(c.whatsapp).toBe("5511900000000");
    expect(c.whatsappLink).toBe("https://wa.me/5511900000000?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Equapar%20e%20quero%20saber%20mais.");
    expect(telefoneFormatado(c.whatsapp!)).toBe("+55 (11) 90000-0000");
  });
  it("B5: sem CNPJ, termos e privacidade dizem empresa em constituição, com responsável, canal e cidade", () => {
    limpar();
    vi.stubEnv("SITE_FUNDADOR_NOME", "Pessoa Exemplo");
    vi.stubEnv("SITE_CIDADE", "Cidade Exemplo/UF");
    vi.stubEnv("SITE_EMAIL_CONTATO", "contato@exemplo.local");
    expect(identificacaoEmpresa()).toMatchObject({ texto: "Equapar, empresa em constituição, sob a responsabilidade de Pessoa Exemplo, Cidade Exemplo/UF", canal: "contato@exemplo.local" });
    vi.stubEnv("SITE_CNPJ", "11222333000181");
    vi.stubEnv("SITE_RAZAO_SOCIAL", "Empresa Exemplo Ltda.");
    vi.stubEnv("SITE_ENDERECO", "Rua Exemplo, 1, Cidade Exemplo/UF");
    expect(identificacaoEmpresa().texto).toBe("Empresa Exemplo Ltda., CNPJ 11.222.333/0001-81, Rua Exemplo, 1, Cidade Exemplo/UF");
  });
  it("B2: domínio equapar.com derivado do ambiente (remetente e identificação no PNCP)", () => {
    limpar();
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("APP_URL", "https://equapar.com");
    expect(remetentePadrao()).toBe("Equapar Avisos <avisos@equapar.com>");
    const agente = agentePncp();
    expect(agente).toMatch(/^Mozilla\/5\.0 .*AppleWebKit\/537\.36 .*Chrome\/\d+/);
    expect(agente).toContain("EquaparBot/1.0");
    expect(agente).toContain("+https://equapar.com; contato@equapar.com");
    vi.stubEnv("EMAIL_FROM", "Equapar Avisos <avisos@exemplo.local>");
    expect(remetentePadrao()).toBe("Equapar Avisos <avisos@exemplo.local>");
  });
});
