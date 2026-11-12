import { beforeEach, describe, expect, it, vi } from "vitest";

// L16: "Mostrar valores em dinheiro no WhatsApp". Ligada: o WhatsApp de deferido leva o valor, com modelo próprio.
// Desligada: nunca leva. E-mail continua com o valor.
const enviados: { canal: string; corpo: string; modelo?: { nome: string; params: Record<string, string> } }[] = [];
const conta = { id: "c1", mostrarValoresWhatsapp: false, membros: [] as unknown[] };
const u = { id: "u1", email: "dono@exemplo.local", whatsapp: "+5527999990000", whatsappConsentEm: new Date(), prefsAvisos: { deferido: "AMBOS" }, emailVerificadoEm: new Date() };
conta.membros = [{ usuario: u }];
vi.mock("./db", () => ({
  db: {
    pedido: {
      findUnique: vi.fn(async () => ({ id: "p1", contratoId: "k1", valorDeferido: "31540.20", contrato: { numero: "12/2024", orgao: "Tribunal Exemplo", empresa: { conta } } })),
    },
  },
}));
vi.mock("./mensagens", async (orig) => ({ ...(await orig<typeof import("./mensagens")>()), enviar: vi.fn(async (e) => enviados.push(e)) }));
const { avisarDeferido } = await import("./avisos");

describe("L16: valores no WhatsApp", () => {
  beforeEach(() => (enviados.length = 0));
  it("desligada: o WhatsApp não leva valor; o e-mail leva", async () => {
    conta.mostrarValoresWhatsapp = false;
    await avisarDeferido("p1");
    const w = enviados.find((e) => e.canal === "WHATSAPP")!;
    expect(w.corpo).not.toMatch(/R\$/);
    expect(w.modelo?.nome).toBe("equapar_deferido");
    expect(enviados.find((e) => e.canal === "EMAIL")!.corpo).toMatch(/R\$ 31\.540,20/);
  });
  it("ligada: o WhatsApp leva o valor, com o modelo próprio", async () => {
    conta.mostrarValoresWhatsapp = true;
    await avisarDeferido("p1");
    const w = enviados.find((e) => e.canal === "WHATSAPP")!;
    expect(w.corpo).toMatch(/R\$ 31\.540,20/);
    expect(w.modelo?.nome).toBe("equapar_deferido_valor");
    expect(w.modelo?.params.valor).toBe("R$ 31.540,20");
  });
});
