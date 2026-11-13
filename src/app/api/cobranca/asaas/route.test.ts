import { afterEach, describe, expect, it, vi } from "vitest";

const processados: unknown[] = [];
vi.mock("@/lib/cobranca-servidor", () => ({ processarEventoPagamento: vi.fn(async (o) => (processados.push(o), "processado")) }));
const { POST } = await import("./route");
const req = (corpo: unknown, token?: string) => new Request("http://x/api/cobranca/asaas", { method: "POST", body: JSON.stringify(corpo), headers: token ? { "asaas-access-token": token } : {} }) as never;

describe("4.2: webhook do Asaas", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    processados.length = 0;
  });
  it("sem o token certo: 401 e nada processado", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token-secreto-com-mais-de-32-caracteres-xyz");
    expect((await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }, "errado"))).status).toBe(401);
    expect((await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }))).status).toBe(401);
    expect(processados).toHaveLength(0);
  });
  it("sem token configurado, recusa sempre", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "");
    expect((await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }, "")))).toHaveProperty("status", 401);
  });
  it("com o token: pagamento recebido vira PAGO, com o id do evento para não repetir", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token-secreto-com-mais-de-32-caracteres-xyz");
    const r = await POST(req({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_1", externalReference: "fat1" } }, "token-secreto-com-mais-de-32-caracteres-xyz"));
    expect(r.status).toBe(200);
    expect(processados[0]).toMatchObject({ gatewayId: "pay_1", faturaId: "fat1", evento: "PAGO", eventoId: "evt_1" });
  });
  it("evento que não interessa: 200 sem processar", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token-secreto-com-mais-de-32-caracteres-xyz");
    const r = await POST(req({ id: "evt_2", event: "PAYMENT_CREATED", payment: { id: "pay_1" } }, "token-secreto-com-mais-de-32-caracteres-xyz"));
    expect(r.status).toBe(200);
    expect(processados).toHaveLength(0);
  });
});
