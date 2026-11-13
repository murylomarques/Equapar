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
  it("ofício pede reequilíbrio e deixa o fundamento para o advogado", async () => {
    const z = await JSZip.loadAsync(await oficioDocx(pedidoId, contaId));
    const xml = await z.file("word/document.xml")!.async("string");
    expect(xml).toContain("REEQUILÍBRIO ECONÔMICO-FINANCEIRO");
    expect(xml).toContain("[fundamento indicado pelo advogado]");
    expect(xml).not.toContain("REPACTUAÇÃO");
  });
  it("minuta do aditivo sai em PDF e entra no pacote", async () => {
    const pdf = await minutaAditivoPdf(pedidoId, contaId);
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    const z = await JSZip.loadAsync(await pacoteZip(pedidoId, contaId));
    expect(Object.keys(z.files).some((n) => n.includes("minuta-aditivo"))).toBe(true);
  });
});
