import { afterEach, describe, expect, it, vi } from "vitest";
import { cobranca, CobrancaAsaas, eventoAsaas, tokenWebhookValido } from "./cobranca";

describe("4.2: gateway de cobrança", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("sem ASAAS_API_KEY: simulação (nada sai do servidor)", async () => {
    vi.stubEnv("ASAAS_API_KEY", "");
    const c = cobranca();
    expect(c.modo).toBe("simulacao");
    const r = await c.criarCobranca({ clienteId: "x", valor: "297.00", vencimento: "2026-11-20", descricao: "Carteira", referenciaExterna: "fat1", metodo: "PIX" });
    expect(r.id).toMatch(/^sim_pay_/);
    expect(r.link).toContain("simular=fat1");
  });
  it("Asaas: cabeçalho access_token, cliente e cobrança com os campos da API", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const http = vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response(JSON.stringify(url.endsWith("/customers") ? { id: "cus_1" } : { id: "pay_1", invoiceUrl: "https://asaas/i/pay_1" }), { status: 200 });
    });
    const a = new CobrancaAsaas("$aact_hmlg_teste", "https://api-sandbox.asaas.com/v3", http as never);
    const cliente = await a.garantirCliente({ contaId: "c1", nome: "Empresa Exemplo (fictícia)", cpfCnpj: "11222333000181", email: "f@exemplo.local", clienteIdAtual: null });
    const r = await a.criarCobranca({ clienteId: cliente, valor: "1497.00", vencimento: "2026-11-20", descricao: "Assessoria", referenciaExterna: "fat9", metodo: "BOLETO" });
    expect(chamadas[0].url).toBe("https://api-sandbox.asaas.com/v3/customers");
    expect((chamadas[0].init.headers as Record<string, string>).access_token).toBe("$aact_hmlg_teste");
    expect(JSON.parse(String(chamadas[1].init.body))).toEqual({ customer: "cus_1", billingType: "BOLETO", value: 1497, dueDate: "2026-11-20", description: "Assessoria", externalReference: "fat9" });
    expect(r).toEqual({ id: "pay_1", link: "https://asaas/i/pay_1" });
    // cliente já existente não é criado de novo
    expect(await a.garantirCliente({ contaId: "c1", nome: "", cpfCnpj: "", email: "", clienteIdAtual: "cus_9" })).toBe("cus_9");
  });
  it("eventos do Asaas viram eventos da Equapar", () => {
    expect(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CREATED"].map(eventoAsaas)).toEqual(["PAGO", "PAGO", "VENCIDO", "ESTORNADO", "CANCELADO", null]);
  });
  it("token do webhook em tempo constante; vazio nunca vale", () => {
    expect(tokenWebhookValido("abc", "abc")).toBe(true);
    expect(tokenWebhookValido("abd", "abc")).toBe(false);
    expect(tokenWebhookValido(null, "abc")).toBe(false);
    expect(tokenWebhookValido("abc", undefined)).toBe(false);
  });
});
