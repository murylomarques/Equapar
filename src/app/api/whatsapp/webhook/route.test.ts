import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco simulado: um usuário e um contato do Raio-X com o celular cadastrado COM o 9.
const usuarios = [{ id: "u1", whatsapp: "+5527999990000", whatsappConsentEm: new Date() }];
const leads = [{ id: "l1", whatsapp: "27999990000", consentimentoAvisos: true }];
vi.mock("@/lib/db", () => ({
  db: {
    usuario: {
      findMany: vi.fn(async ({ where }) => usuarios.filter((u) => u.whatsapp.endsWith(where.whatsapp.endsWith))),
      update: vi.fn(async ({ where, data }) => Object.assign(usuarios.find((u) => u.id === where.id)!, data)),
    },
    lead: {
      findMany: vi.fn(async ({ where }) => leads.filter((l) => l.whatsapp?.endsWith(where.whatsapp.endsWith))),
      update: vi.fn(async ({ where, data }) => Object.assign(leads.find((l) => l.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }) => {
        for (const l of leads) if (l.whatsapp?.endsWith(where.whatsapp.endsWith)) Object.assign(l, data);
      }),
    },
  },
}));

const { POST } = await import("./route");
const pedir = (corpo: string) => POST(new Request("http://x/api/whatsapp/webhook", { method: "POST", body: corpo }) as never);
const mensagem = (from: string, body: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: "text", text: { body } }] } }] }] });

describe("C5: webhook do WhatsApp", () => {
  beforeEach(() => {
    usuarios[0].whatsappConsentEm = new Date();
    leads[0].whatsapp = "27999990000";
    leads[0].consentimentoAvisos = true;
  });

  it("corpo que não é JSON responde 400 (antes: erro 500)", async () => {
    const r = await pedir("isto não é json");
    expect(r.status).toBe(400);
  });

  it("'Parar' vindo do número SEM o 9 encerra os avisos de quem cadastrou COM o 9", async () => {
    const r = await pedir(mensagem("552799990000", "Parar"));
    expect(r.status).toBe(200);
    expect(usuarios[0].whatsappConsentEm).toBeNull();
    expect(leads[0].consentimentoAvisos).toBe(false);
  });

  it("mensagem comum não encerra", async () => {
    await pedir(mensagem("5527999990000", "obrigado"));
    expect(usuarios[0].whatsappConsentEm).not.toBeNull();
  });
});
