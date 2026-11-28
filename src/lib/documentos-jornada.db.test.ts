import { afterAll, beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db } from "./db";
import { minutaAditivoPdf, oficioDocx, pacoteZip } from "./documentos";
import { planilhaDoCenario } from "./jornada";
import type { PlanilhaCustos } from "./calculo/tipos";

// 5.1: documentos do pedido da jornada (precisa do PostgreSQL: npm run test:db). Cria e apaga só o próprio pedido.
let pedidoId = "";
let contaId = "";

beforeAll(async () => {
  const base = await db.pedido.findFirst({
    where: { planilhaAntes: { not: undefined }, contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } },
    include: { contrato: { include: { empresa: true } } },
  });
  if (!base?.planilhaAntes) throw new Error("Rode o seed: falta um pedido de exemplo com planilha.");
  contaId = base.contrato.empresa.contaId;
  const antes = base.planilhaAntes as unknown as PlanilhaCustos;
  const p = await db.pedido.create({
    data: {
      contratoId: base.contratoId,
      gatilho: "JORNADA_EC141",
      dataBase: new Date(Date.UTC(2026, 11, 16)),
      inicioJornada: new Date(Date.UTC(2026, 11, 16)),
      dataReferencia: new Date(Date.UTC(2027, 1, 28)),
      jornadaAntes: 44,
      jornadaDepois: 40,
      horasCobertura: "44.00",
      cenarioJornada: "MANTER_HORAS",
      jornadaEnquadramento: "VIGENTE_NA_EC",
      planilhaAntes: antes as never,
      planilhaAgora: planilhaDoCenario(antes, "MANTER_HORAS", 44, 40) as never,
      passoAtual: 4,
    },
  });
  pedidoId = p.id;
});

afterAll(async () => {
  if (pedidoId) await db.pedido.delete({ where: { id: pedidoId } });
  await db.$disconnect();
});

describe("5.1: documentos do pedido da jornada", () => {
  it("ofício pede a adequação por termo aditivo, com o fundamento do parecer e as datas separadas", async () => {
    const z = await JSZip.loadAsync(await oficioDocx(pedidoId, contaId));
    const xml = await z.file("word/document.xml")!.async("string");
    expect(xml).toContain("ADEQUAÇÃO CONTRATUAL");
    expect(xml).toContain("art. 9º da EC 141/2026");
    expect(xml).toContain("não se aplica a exigência de anualidade");
    expect(xml).toContain("Efeitos financeiros pleiteados a partir de");
    expect(xml).not.toContain("REPACTUAÇÃO");
    // A4: os três cenários lado a lado, a opção da empresa marcada e o rito do órgão
    expect(xml).toContain("Manter a cobertura operacional [opção apresentada pela empresa]");
    expect(xml).toContain("Reduzir as horas de cobertura");
    expect(xml).toContain("Reorganizar as escalas");
    expect(xml).toContain("A escolha do cenário e a formalização cabem ao órgão, pelo rito do contrato.");
    // D0: marca de simulação enquanto a chave mestra está desligada
    expect(xml).toContain("SIMULAÇÃO: regra em validação. Não protocolar.");
  });
  it("minuta do aditivo sai em PDF e entra no pacote", async () => {
    const pdf = await minutaAditivoPdf(pedidoId, contaId);
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    const z = await JSZip.loadAsync(await pacoteZip(pedidoId, contaId, { rascunho: true }));
    // A5: os documentos da jornada no pacote
    for (const nome of ["oficio", "planilha", "memoria-de-calculo", "fundamentacao-normativa", "demonstrativo-retroativo", "minuta-aditivo"])
      expect(Object.keys(z.files).some((n) => n.includes(nome))).toBe(true);
  }, 15_000);
});
