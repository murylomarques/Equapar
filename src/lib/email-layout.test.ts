import { describe, expect, it } from "vitest";
import { emailHtml, rotuloLink, separarBotao, urlLegivel } from "./email-layout";
import { MODELOS } from "./mensagens";

const L = "https://equapar.com.br/r/abc?para=%2Fapp%2Fcontratos%2F1";
const L2 = "https://equapar.com.br/r/def?para=%2Fcriar-conta%3Fcnpj%3D1";

describe("separarBotao", () => {
  it("aviso de 60 dias: 'Ver o que falta' vira o botão e sai do texto", () => {
    const corpo = MODELOS.equapar_prazo_60({ numero: "45/2025", orgao: "Prefeitura de Exemplo", data: "26/01/2027", ano: "2027", link: L });
    const r = separarBotao(corpo);
    expect(r.botao).toEqual({ rotulo: "Ver o que falta", url: L });
    expect(r.texto).toBe(
      "Equapar: o contrato 45/2025 com Prefeitura de Exemplo termina em 26/01/2027. Se a convenção de 2027 já foi depositada, o pedido de repactuação precisa sair antes da prorrogação.",
    );
  });

  it("aviso de 30 dias: 'Abrir' vira o rótulo do tipo", () => {
    const r = separarBotao(MODELOS.equapar_prazo_30({ numero: "1/2026", orgao: "Órgão", situacao: "nenhum pedido aberto", link: L }), "D30");
    expect(r.botao).toEqual({ rotulo: "Abrir o contrato", url: L });
    expect(r.texto).toBe("Equapar: faltam 30 dias para o fim do contrato 1/2026 (Órgão). Situação do pedido: nenhum pedido aberto.");
  });

  it("deferido: link solto depois de um ponto vira o botão do tipo, e o valor continua no texto", () => {
    const corpo = `${MODELOS.equapar_deferido({ numero: "1/2026", link: L })}\nValor deferido: R$ 1.000,00.`;
    const r = separarBotao(corpo, "DEFERIDO");
    expect(r.botao).toEqual({ rotulo: "Ver a receber", url: L });
    expect(r.texto).toBe("Equapar: o pedido do contrato 1/2026 foi marcado como deferido. Próximo passo: apostilamento e fatura da diferença.\nValor deferido: R$ 1.000,00.");
  });

  it("confirmação: frase longa antes do link; o link sai e o botão usa o rótulo do tipo", () => {
    const corpo = `Olá, Ana. Para receber os avisos de prazo, confirme seu e-mail: ${L}\n\nO link vale por 24 horas. Se você não criou uma conta na Equapar, ignore esta mensagem.`;
    const r = separarBotao(corpo, "CONFIRMAR_EMAIL");
    expect(r.botao).toEqual({ rotulo: "Confirmar e-mail", url: L });
    expect(r.texto).toBe("Olá, Ana. Para receber os avisos de prazo, confirme seu e-mail.\n\nO link vale por 24 horas. Se você não criou uma conta na Equapar, ignore esta mensagem.");
  });

  it("Raio-X: 'Ver o relatório' é o botão; o link de criar conta fica no texto", () => {
    const corpo = `Olá. O relatório do Raio-X está pronto.\n\nVer o relatório: ${L}\n\nPara montar o pedido, crie sua conta em ${L2}\n\nVocê recebeu esta mensagem porque pediu o relatório.`;
    const r = separarBotao(corpo, "RAIOX");
    expect(r.botao).toEqual({ rotulo: "Ver o relatório", url: L });
    expect(r.texto).toContain(`crie sua conta em ${L2}`);
    expect(r.texto).not.toContain("Ver o relatório");
  });

  it("jornada: o link da fonte nunca vira botão", () => {
    const corpo = `Equapar: texto.\n\nVer os contratos e montar os pedidos: ${L}\nFonte: Diário Oficial. https://www.planalto.gov.br/x`;
    const r = separarBotao(corpo, "JORNADA");
    expect(r.botao).toEqual({ rotulo: "Ver os contratos e montar os pedidos", url: L });
    expect(r.texto).toContain("Fonte: Diário Oficial. https://www.planalto.gov.br/x");
  });

  it("resumo semanal: itens da lista não viram botão", () => {
    const corpo = `Sua semana na Equapar\n\nPRECISA DE VOCÊ (1)\n- Montar pedido · Contrato 1 · Órgão · até 10/12: ${L}`;
    expect(separarBotao(corpo, "SEMANAL")).toMatchObject({ texto: corpo, botao: null });
  });

  it("sem link: sem botão", () => {
    expect(separarBotao("Sua conta agora entra com o Google.")).toMatchObject({ texto: "Sua conta agora entra com o Google.", botao: null });
  });
});

describe("posição do botão", () => {
  it("fica no fim do parágrafo de onde saiu o link (Raio-X: antes do aviso de por que recebeu)", () => {
    const corpo = `Olá. O relatório está pronto.

Ver o relatório: ${L}

Você recebeu esta mensagem porque pediu o relatório.`;
    const r = separarBotao(corpo, "RAIOX");
    expect(r.antes).toBe("Olá. O relatório está pronto.");
    expect(r.depois).toBe("Você recebeu esta mensagem porque pediu o relatório.");
  });

  it("deferido: o valor (mesmo parágrafo) fica antes do botão", () => {
    const r = separarBotao(`${MODELOS.equapar_deferido({ numero: "1/2026", link: L })}
Valor deferido: R$ 1.000,00.`, "DEFERIDO");
    expect(r.antes).toContain("Valor deferido: R$ 1.000,00.");
    expect(r.depois).toBe("");
  });
});

describe("urlLegivel", () => {
  it("link rastreado vira o endereço real; outros ficam iguais", () => {
    expect(urlLegivel(L)).toBe("https://equapar.com.br/app/contratos/1");
    expect(urlLegivel("https://www.asaas.com/i/abc")).toBe("https://www.asaas.com/i/abc");
  });
});

describe("rotuloLink", () => {
  it("link rastreado mostra o destino real, sem a consulta", () => {
    expect(rotuloLink(L2)).toBe("equapar.com.br/criar-conta");
    expect(rotuloLink("https://www.planalto.gov.br/ccivil/x.htm")).toBe("planalto.gov.br/ccivil/x.htm");
  });
});

describe("emailHtml", () => {
  const corpo = MODELOS.equapar_prazo_60({ numero: "45/2025", orgao: "Prefeitura <Exemplo>", data: "26/01/2027", ano: "2027", link: L });
  const html = emailHtml({ assunto: "Em 60 dias: contrato 45/2025", texto: corpo, appUrl: "https://equapar.com.br/", rodapePreferencias: true });

  it("tem logo, título, botão e rodapé com as preferências", () => {
    expect(html).toContain('src="https://equapar.com.br/email/equapar-logo.png"');
    expect(html).toContain("Em 60 dias: contrato 45/2025</h1>");
    expect(html).toContain(">Ver o que falta</a>");
    expect(html).toContain("https://equapar.com.br/app/configuracoes");
  });

  it("escapa o texto e tira o prefixo 'Equapar:' do corpo e do título", () => {
    expect(html).toContain("Prefeitura &lt;Exemplo&gt;");
    expect(html).not.toContain("<Exemplo>");
    expect(html).toMatch(/<p [^>]*>O contrato 45\/2025/);
    const h = emailHtml({ assunto: "Equapar: fatura para revisar", texto: "x", appUrl: "https://equapar.com.br", rodapePreferencias: false });
    expect(h).toContain(">Fatura para revisar</h1>");
  });

  it("sem conta (ex.: Raio-X para visitante): rodapé sem link de preferências", () => {
    const h = emailHtml({ assunto: "Raio-X", texto: `Veja: ${L}`, appUrl: "https://equapar.com.br", rodapePreferencias: false });
    expect(h).not.toContain("/app/configuracoes");
  });

  it("resumo semanal: seção vira título e itens viram lista com link", () => {
    const h = emailHtml({
      assunto: "Sua semana",
      texto: `Sua semana na Equapar\n\nPRECISA DE VOCÊ (1)\n- Montar pedido · Contrato 1: ${L}\n\nA RECEBER: R$ 10,00`,
      appUrl: "https://equapar.com.br",
      rodapePreferencias: true,
    });
    expect(h).toContain(">PRECISA DE VOCÊ (1)</p>");
    expect(h).toContain(">A RECEBER: R$&nbsp;10,00</p>");
    expect(h).toContain(`<a href="${L.replace(/&/g, "&amp;")}" style="color:#16181d;text-decoration:none">Montar pedido · Contrato 1&nbsp;<span`);
  });
});
