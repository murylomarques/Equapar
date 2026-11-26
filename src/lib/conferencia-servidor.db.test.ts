import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { abrirConferencia, registrarAcessoConferencia } from "./conferencia-servidor";
import { ACAO_LINK_REVOGADO, tokenConferencia } from "./conferencia";

// Link de conferência para o contador (precisa do PostgreSQL com o seed: npm run test:db).
// Cria um pedido FICTÍCIO num contrato de exemplo e apaga no fim.
let pedidoId = "";
let contaId = "";
let contratoId = "";

beforeAll(async () => {
  const base = await db.pedido.findFirst({
    where: { planilhaAntes: { not: undefined }, planilhaAgora: { not: undefined }, gatilho: { not: "JORNADA_EC141" }, contrato: { empresa: { exemplo: true, conta: { demo: false, tipo: "EMPRESA" } } } },
    include: { contrato: { include: { empresa: true } } },
  });
  if (!base?.planilhaAntes || !base.planilhaAgora) throw new Error("Rode o seed: falta um pedido de exemplo com planilhas.");
  contaId = base.contrato.empresa.contaId;
  contratoId = base.contratoId;
  const p = await db.pedido.create({
    data: { contratoId, dataBase: base.dataBase, dataReferencia: base.dataReferencia, planilhaAntes: base.planilhaAntes as never, planilhaAgora: base.planilhaAgora as never, passoAtual: 4 },
  });
  pedidoId = p.id;
});

afterAll(async () => {
  if (pedidoId) await db.pedido.delete({ where: { id: pedidoId } });
  await db.tentativaAcesso.deleteMany({ where: { chave: { startsWith: "cota:conferir:link:" } } });
  await db.$disconnect();
});

describe("conferência pelo contador", () => {
  it("abre o pedido certo com o link válido e registra o acesso uma vez por hora", async () => {
    const r = await abrirConferencia(tokenConferencia(pedidoId, contaId), new Headers());
    if (r.erro) throw new Error(r.erro);
    expect(r.p.id).toBe(pedidoId);
    await registrarAcessoConferencia(r.p, "abriu a memória de cálculo");
    await registrarAcessoConferencia(r.p, "abriu a memória de cálculo");
    expect(await db.historico.count({ where: { pedidoId, acao: "Conferência pelo contador: abriu a memória de cálculo" } })).toBe(1);
  });

  it("link de outra conta não abre o pedido", async () => {
    const r = await abrirConferencia(tokenConferencia(pedidoId, "outra-conta"), new Headers());
    expect(r).toEqual({ erro: "invalido" });
  });

  it("link vencido não abre", async () => {
    const r = await abrirConferencia(tokenConferencia(pedidoId, contaId, Date.now() - 15 * 86_400_000), new Headers());
    expect(r).toEqual({ erro: "vencido" });
  });

  it("revogar desativa os links já enviados; um link novo abre", async () => {
    const antigo = tokenConferencia(pedidoId, contaId, Date.now() - 1000);
    await db.historico.create({ data: { contaId, pedidoId, contratoId, acao: ACAO_LINK_REVOGADO, criadoEm: new Date() } });
    expect(await abrirConferencia(antigo, new Headers())).toEqual({ erro: "revogado" });
    const novo = tokenConferencia(pedidoId, contaId, Date.now() + 10);
    const r = await abrirConferencia(novo, new Headers());
    expect(r.erro).toBeUndefined();
  });
});
