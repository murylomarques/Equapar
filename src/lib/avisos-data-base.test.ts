import { beforeEach, describe, expect, it, vi } from "vitest";

// Aviso da data-base da convenção: 30 e 7 dias antes, e no dia; um por convenção e data-base, pelos canais de "Prazos".
// Também: apostilamento e resumo semanal só para quem confirmou o e-mail. Dados fictícios.
type Envio = { chave: string; tipo: string; canal: string; destino: string; assunto?: string; corpo: string; contratoId?: string | null; modelo?: { nome: string } };
const enviados: Envio[] = [];
const confirmado = new Date("2026-01-01T00:00:00Z");
const dono = { id: "u1", email: "dono@exemplo.local", whatsapp: "+5527999990000", whatsappConsentEm: confirmado, prefsAvisos: null, emailVerificadoEm: confirmado as Date | null };
const gerente = { id: "u2", email: "gerente@exemplo.local", whatsapp: null, whatsappConsentEm: null, prefsAvisos: { prazo: "WHATSAPP" }, emailVerificadoEm: confirmado as Date | null };
const semConfirmar = { id: "u3", email: "novo@exemplo.local", whatsapp: null, whatsappConsentEm: null, prefsAvisos: null, emailVerificadoEm: null };
const conta = { id: "a", demo: false, avisoJornadaEm: null, membros: [dono, gerente, semConfirmar].map((usuario) => ({ usuario })), empresas: [{ exemplo: false }] };
const conv = { id: "convexemplo0001", nome: "CCT Asseio Exemplo/ES 2026 (fictícia)", mesDataBase: 3, dataDeposito: new Date("2026-03-10T00:00:00Z") };
const base = { orgao: "Prefeitura Municipal de Exemplo", arquivado: false, vigenciaInicio: new Date("2026-01-01T00:00:00Z"), vigenciaFim: new Date("2028-12-31T00:00:00Z"), dataProposta: null };
let contratos: Record<string, unknown>[] = [];

vi.mock("./db", () => ({
  db: {
    conta: { findMany: vi.fn(async () => [conta]), update: vi.fn() },
    contrato: { findMany: vi.fn(async () => contratos) },
  },
}));
vi.mock("./mensagens", async (orig) => ({ ...(await orig<typeof import("./mensagens")>()), enviar: vi.fn(async (e: Envio) => (enviados.push(e), {})) }));
const { rodarAvisos, listaContratos } = await import("./avisos");

const agoraEm = (dia: string) => new Date(`${dia}T15:00:00Z`); // 12h em Brasília
const doTipo = (prefixo: string) => enviados.filter((e) => e.chave.startsWith(prefixo));

beforeEach(() => {
  enviados.length = 0;
  contratos = [
    { ...base, id: "k1", numero: "45/2025", tipoReajuste: "REPACTUACAO", maoDeObraDedicada: true, convencao: conv, pedidos: [] },
    { ...base, id: "k2", numero: "12/2026", tipoReajuste: "REPACTUACAO", maoDeObraDedicada: true, convencao: conv, pedidos: [] },
    // reajuste por índice e contrato sem mão de obra não avisam a data-base
    { ...base, id: "k3", numero: "7/2026", tipoReajuste: "INDICE", maoDeObraDedicada: true, convencao: { ...conv, id: "convindice00001" }, pedidos: [] },
    { ...base, id: "k4", numero: "8/2026", tipoReajuste: "REPACTUACAO", maoDeObraDedicada: false, convencao: { ...conv, id: "convsemmao00001" }, pedidos: [] },
  ];
});

describe("aviso da data-base da convenção", () => {
  it("7 dias antes: um evento por convenção (não por contrato), com chave por marco e data", async () => {
    const r = await rodarAvisos({ agora: agoraEm("2027-02-22") });
    const db = doTipo("DB");
    expect(new Set(db.map((e) => e.chave))).toEqual(new Set(["DB7:convexemplo0001:2027-03-01"]));
    expect(r.dataBase).toBe(1);
    expect(db.every((e) => e.tipo === "DB7" && !e.contratoId)).toBe(true);
    const email = db.find((e) => e.canal === "EMAIL")!;
    expect(email.assunto).toBe("Data-base em 7 dias: CCT Asseio Exemplo/ES 2026 (fictícia)");
    expect(email.corpo).toContain("em 01/03/2027 é a data-base da CCT Asseio Exemplo/ES 2026 (fictícia)");
    expect(email.corpo).toContain("2 contratos (45/2025 e 12/2026)");
    expect(email.corpo).toContain("/app/convencoes#convencao-convexemplo0001");
    expect(email.corpo).toContain("/app/contratos/k1?aba=prazos");
  });

  it("respeita canais e preferências de Prazos, e exige e-mail confirmado (como o aviso do fim da vigência)", async () => {
    await rodarAvisos({ agora: agoraEm("2027-02-10") }); // quarta: DB30, sem resumo semanal
    const db = doTipo("DB30:");
    expect(db.map((e) => `${e.canal}:${e.destino}`).sort()).toEqual(["EMAIL:dono@exemplo.local", "WHATSAPP:+5527999990000"]);
    // gerente escolheu só WhatsApp e não tem número; quem não confirmou o e-mail não recebe
    expect(db.some((e) => e.destino.includes("novo@"))).toBe(false);
    expect(db.find((e) => e.canal === "WHATSAPP")!.modelo?.nome).toBe("equapar_data_base");
  });

  it("no dia: modelo próprio, com o caminho para a convenção pendente (ressalva antes da prorrogação)", async () => {
    await rodarAvisos({ agora: agoraEm("2027-03-01") });
    const db = doTipo("DB0:");
    expect(db[0].chave).toBe("DB0:convexemplo0001:2027-03-01");
    expect(db[0].assunto).toBe("Data-base chegou: CCT Asseio Exemplo/ES 2026 (fictícia)");
    expect(db[0].corpo).toMatch(/ressalve o direito no termo aditivo antes de assinar a prorrogação/);
    expect(db.find((e) => e.canal === "WHATSAPP")!.modelo?.nome).toBe("equapar_data_base_chegou");
  });

  it("fora das janelas, nada; contrato arquivado não é carregado (a consulta já filtra)", async () => {
    await rodarAvisos({ agora: agoraEm("2027-01-15") });
    expect(doTipo("DB")).toHaveLength(0);
  });

  it("rodar duas vezes gera as mesmas chaves (a idempotência fica no enviar, pela chave única)", async () => {
    await rodarAvisos({ agora: agoraEm("2027-02-23") });
    const primeira = doTipo("DB").map((e) => `${e.chave}|${e.canal}|${e.destino}`);
    await rodarAvisos({ agora: agoraEm("2027-02-24") });
    const todas = doTipo("DB").map((e) => `${e.chave}|${e.canal}|${e.destino}`);
    expect(new Set(todas)).toEqual(new Set(primeira));
  });
});

describe("C7: apostilamento e resumo semanal só com e-mail confirmado", () => {
  it("quem não confirmou o e-mail não recebe nem o alerta de apostilamento nem o resumo", async () => {
    contratos = [
      {
        ...base,
        id: "k9",
        numero: "9/2026",
        tipoReajuste: "INDICE",
        maoDeObraDedicada: false,
        convencao: null,
        pedidos: [{ id: "pedidoexemplo01", estado: "DEFERIDO", apostiladoEm: null, deferidoEm: new Date("2026-09-01T00:00:00Z"), valorDeferido: "1000", retroativoAprovado: null, notasFiscais: [], baixas: [] }],
      },
    ];
    await rodarAvisos({ agora: agoraEm("2026-11-23") }); // segunda-feira, 12h em Brasília
    const destinos = (prefixo: string) => doTipo(prefixo).map((e) => e.destino).sort();
    expect(destinos("APOSTILAMENTO:")).toEqual(["dono@exemplo.local", "gerente@exemplo.local"]);
    expect(destinos("SEMANAL:")).toEqual(["dono@exemplo.local", "gerente@exemplo.local"]);
    // o resumo usa o saldo da tela A receber
    expect(doTipo("SEMANAL:")[0].corpo).toContain("A RECEBER: R$ 1 mil");
  });
});

describe("lista de contratos no texto", () => {
  it("até 3 números; acima disso, 'e mais N'", () => {
    expect(listaContratos(["1/2026"])).toBe("1 contrato (1/2026)");
    expect(listaContratos(["1/2026", "2/2026", "3/2026"])).toBe("3 contratos (1/2026, 2/2026 e 3/2026)");
    expect(listaContratos(["1/2026", "2/2026", "3/2026", "4/2026", "5/2026"])).toBe("5 contratos (1/2026, 2/2026, 3/2026 e mais 2)");
  });
});
