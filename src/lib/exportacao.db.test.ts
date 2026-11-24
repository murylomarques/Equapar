import { afterAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db } from "./db";
import { executarExportacao } from "./exportacao";
import { apagarArquivo, lerArquivo } from "./storage";

// Jornada 18 (npm run test:db): "Exportar tudo" roda como no worker, gera o ZIP e leva só os dados da própria conta.
let trabalhoId = "";
let caminho: string | null = null;

afterAll(async () => {
  if (caminho) await apagarArquivo(caminho).catch(() => {});
  if (trabalhoId) await db.trabalhoFundo.delete({ where: { id: trabalhoId } }).catch(() => {});
  await db.$disconnect();
});

describe("Exportar tudo (LGPD)", () => {
  it("gera o ZIP com os dados e os arquivos da conta, sem nada de outra conta", async () => {
    const dono = await db.usuario.findUniqueOrThrow({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
    const contaId = dono.membros[0].contaId;
    const t = await db.trabalhoFundo.create({ data: { contaId, usuarioId: dono.id, tipo: "EXPORTAR", status: "RODANDO" } });
    trabalhoId = t.id;
    await executarExportacao(t.id, contaId);
    const pronto = await db.trabalhoFundo.findUniqueOrThrow({ where: { id: t.id } });
    expect(pronto.status).toBe("PRONTO");
    caminho = pronto.caminho;
    const zip = await JSZip.loadAsync(await lerArquivo(pronto.caminho!));
    const dados = JSON.parse(await zip.file("dados.json")!.async("string"));
    expect(dados.id).toBe(contaId);
    const meus = new Set((await db.contrato.findMany({ where: { empresa: { contaId } }, select: { id: true } })).map((c) => c.id));
    const exportados: string[] = dados.empresas.flatMap((e: { contratos: { id: string }[] }) => e.contratos.map((c) => c.id));
    expect(exportados.length).toBe(meus.size);
    expect(exportados.every((id) => meus.has(id))).toBe(true);
    // segredos de login nunca saem na exportação
    const texto = JSON.stringify(dados);
    expect(texto).not.toMatch(/senhaHash|totpSegredo|codigosRecuperacao/);
    expect(zip.file("arquivos-ausentes.json")).toBeTruthy();
  }, 60_000);
});
