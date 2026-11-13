import { describe, expect, it, vi } from "vitest";

let bancoOk = true;
vi.mock("@/lib/db", () => ({ db: { $queryRaw: vi.fn(async () => { if (!bancoOk) throw new Error("ECONNREFUSED"); return [{ ok: 1 }]; }) } }));
const { GET } = await import("./route");

describe("4.1.4: /api/saude", () => {
  it("banco no ar: 200 com o estado de cada parte", async () => {
    bancoOk = true;
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, banco: "ok" });
  });
  it("banco fora: 503, sem detalhe técnico na resposta", async () => {
    bancoOk = false;
    const r = await GET();
    expect(r.status).toBe(503);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ ok: false, banco: "falha" });
    expect(JSON.stringify(corpo)).not.toMatch(/ECONNREFUSED/);
  });
});
