import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { rodarAvisos } from "./avisos";
import { classificarAvisos, ehPendente } from "@/app/app/avisos/eventos";
import type { Contexto } from "./auth";

// Aviso da data-base da convenção (precisa do PostgreSQL: npm run test:db). Conta, pessoa e contratos FICTÍCIOS,
// envio sempre em simulação (sem SMTP nem WhatsApp); apaga o que criou.
const sufixo = `${Date.now()}`;
let contaId = "";
let usuarioId = "";
let convencaoId = "";
const quarta = new Date("2027-02-24T15:00:00Z"); // 12h em Brasília; data-base em 01/03/2027 (5 dias): marco DB7

beforeAll(async () => {
  vi.stubEnv("SMTP_URL", "");
  vi.stubEnv("WHATSAPP_TOKEN", "");
  vi.stubEnv("JORNADA_REGRA_CONFIRMADA", "false");
  const conta = await db.conta.create({ data: { nome: `Conta teste data-base ${sufixo} (fictícia)` } });
  contaId = conta.id;
  const u = await db.usuario.create({ data: { nome: "Pessoa Teste", email: `data-base-${sufixo}@exemplo.local`, emailVerificadoEm: new Date() } });
  usuarioId = u.id;
  await db.membro.create({ data: { usuarioId, contaId, papel: "DONO" } });
  const e = await db.empresa.create({ data: { contaId, cnpj: `D${sufixo}`.slice(0, 14), razaoSocial: "Empresa Teste Ltda. (fictícia)" } });
  const conv = await db.convencao.create({ data: { contaId, nome: "CCT Teste ES 2026 (fictícia)", uf: "ES", ano: 2026, mesDataBase: 3 } });
  convencaoId = conv.id;
  const contrato = { empresaId: e.id, orgao: "Órgão Exemplo", objeto: "Limpeza (exemplo)", vigenciaInicio: new Date("2026-01-01T00:00:00Z"), vigenciaFim: new Date("2028-12-31T00:00:00Z"), maoDeObraDedicada: true, convencaoId };
  await db.contrato.create({ data: { ...contrato, numero: "1/2026" } });
  await db.contrato.create({ data: { ...contrato, numero: "2/2026" } });
  // arquivado: não entra na lista do aviso
  await db.contrato.create({ data: { ...contrato, numero: "3/2026", arquivado: true } });
});
afterAll(async () => {
  await db.conta.deleteMany({ where: { id: contaId } });
  await db.usuario.deleteMany({ where: { id: usuarioId } });
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("aviso da data-base no banco", () => {
  it("grava um aviso por convenção, data-base e marco; rodar de novo não duplica", async () => {
    const r1 = await rodarAvisos({ contaId, agora: quarta });
    expect(r1.dataBase).toBe(1);
    await rodarAvisos({ contaId, agora: new Date(quarta.getTime() + 60 * 60 * 1000) }); // a rotina da hora seguinte
    const avisos = await db.aviso.findMany({ where: { contaId, tipo: { startsWith: "DB" } } });
    expect(avisos.map((a) => `${a.chave}|${a.canal}`)).toEqual([`DB7:${convencaoId}:2027-03-01|EMAIL`]);
    expect(avisos[0].status).toBe("SIMULADO");
    expect(avisos[0].corpo).toContain("2 contratos (1/2026 e 2/2026)");
    expect(avisos[0].corpo).not.toContain("3/2026");
  });

  it("o marco seguinte (no dia) é outro aviso, mas o mesmo evento na central de avisos", async () => {
    await rodarAvisos({ contaId, agora: new Date("2027-03-01T15:00:00Z") });
    const linhas = await db.aviso.findMany({ where: { contaId }, orderBy: { enviadoEm: "desc" } });
    expect(linhas.filter((a) => a.tipo.startsWith("DB")).map((a) => a.tipo).sort()).toEqual(["DB0", "DB7"]);
    const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    const { itens } = await classificarAvisos({ conta } as unknown as Contexto, linhas);
    const daDataBase = itens.filter((x) => x.ev.convencaoId === convencaoId);
    expect(daDataBase).toHaveLength(1);
    expect(daDataBase[0].ev.envios).toHaveLength(2);
    expect(ehPendente(daDataBase[0])).toBe(true);
    expect(daDataBase[0].c.objeto).toContain("2 contratos");
  });

  it("registrada a convenção nova (depósito depois da data-base), o evento sai de Precisa de você", async () => {
    await db.convencao.update({ where: { id: convencaoId }, data: { dataDeposito: new Date("2027-03-10T00:00:00Z"), situacao: "REGISTRADA" } });
    const linhas = await db.aviso.findMany({ where: { contaId }, orderBy: { enviadoEm: "desc" } });
    const conta = await db.conta.findUniqueOrThrow({ where: { id: contaId } });
    const { itens } = await classificarAvisos({ conta } as unknown as Contexto, linhas);
    const ev = itens.find((x) => x.ev.convencaoId === convencaoId)!;
    expect(ev.c.situacao).toBe("RESOLVIDO");
    expect(ehPendente(ev)).toBe(false);
  });
});
