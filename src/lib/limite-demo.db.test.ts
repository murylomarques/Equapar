import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { usarCota } from "./limite";
import { limparDemos } from "./limpeza-demos";

// A3 (precisa do PostgreSQL: npm run test:db). Usa só chaves de teste.
const CHAVE = `demo:teste-${Date.now()}`;
afterAll(async () => {
  await db.tentativaAcesso.deleteMany({ where: { chave: CHAVE } });
  await db.$disconnect();
});

describe("A3: limite e limpeza das demonstrações", () => {
  it("3 por IP por hora; a quarta é recusada, mesmo em paralelo", async () => {
    const r = await Promise.all(Array.from({ length: 6 }, () => usarCota(CHAVE, 3, 3_600_000)));
    expect(r.filter(Boolean)).toHaveLength(3);
  });
  it("a simulação nunca inclui conta de cliente nem a conta modelo", async () => {
    const r = await limparDemos({ aplicar: false });
    expect(r.modo).toBe("simulacao");
    expect(r.contasDeClienteNaLista).toBe(0);
    expect(r.modelosNaLista).toBe(0);
  });
});
