/**
 * Fase 1 (4.2). Cobrança atrás de uma interface única. Gateway escolhido pelo dono: Asaas (Pix, boleto e cartão).
 * Sem ASAAS_API_KEY, SIMULAÇÃO: nada sai do servidor e a própria tela permite simular o pagamento.
 * Ligar a chave real é decisão do dono (trava 5). Documentação: https://docs.asaas.com
 *   - autenticação no cabeçalho `access_token`; produção https://api.asaas.com/v3, sandbox https://api-sandbox.asaas.com/v3
 *   - POST /customers (name, cpfCnpj, email, externalReference) → id "cus_…"
 *   - POST /payments (customer, billingType, value, dueDate, description, externalReference) → id, status, invoiceUrl
 *   - webhook: cabeçalho `asaas-access-token`; eventos PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, PAYMENT_DELETED…
 * A nota fiscal de serviço fica atrás de outra interface (NotaFiscal), em simulação até o dono decidir o emissor.
 */
import crypto from "node:crypto";
import type { EventoPagamento } from "./planos";

export type Metodo = "PIX" | "BOLETO" | "CARTAO";

export interface NovaCobranca {
  clienteId: string;
  valor: string; // "1497.00"
  vencimento: string; // "AAAA-MM-DD"
  descricao: string;
  referenciaExterna: string; // id da fatura na Equapar
  metodo: Metodo | "ESCOLHER";
}

export interface Cobranca {
  readonly modo: "simulacao" | "asaas";
  garantirCliente(c: { contaId: string; nome: string; cpfCnpj: string; email: string; clienteIdAtual: string | null }): Promise<string>;
  criarCobranca(n: NovaCobranca): Promise<{ id: string; link: string }>;
}

export interface NotaFiscal {
  readonly modo: "simulacao";
  emitir(f: { faturaId: string; valor: string; descricao: string }): Promise<{ url: string | null }>;
}

class CobrancaSimulada implements Cobranca {
  readonly modo = "simulacao" as const;
  async garantirCliente(c: { contaId: string; clienteIdAtual: string | null }) {
    return c.clienteIdAtual ?? `sim_cus_${c.contaId}`;
  }
  async criarCobranca(n: NovaCobranca) {
    return { id: `sim_pay_${crypto.randomBytes(6).toString("hex")}`, link: `/app/configuracoes?aba=cobranca&simular=${encodeURIComponent(n.referenciaExterna)}` };
  }
}

const TIPO_ASAAS: Record<NovaCobranca["metodo"], string> = { PIX: "PIX", BOLETO: "BOLETO", CARTAO: "CREDIT_CARD", ESCOLHER: "UNDEFINED" };

export class CobrancaAsaas implements Cobranca {
  readonly modo = "asaas" as const;
  constructor(
    private chave: string,
    private base: string,
    private http: typeof fetch = fetch,
  ) {}
  private async chamar<T>(caminho: string, corpo: unknown): Promise<T> {
    const r = await this.http(`${this.base}${caminho}`, {
      method: "POST",
      headers: { access_token: this.chave, "content-type": "application/json", "user-agent": "Equapar" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`Asaas ${caminho} respondeu ${r.status}`);
    return (await r.json()) as T;
  }
  async garantirCliente(c: { contaId: string; nome: string; cpfCnpj: string; email: string; clienteIdAtual: string | null }) {
    if (c.clienteIdAtual) return c.clienteIdAtual;
    const r = await this.chamar<{ id: string }>("/customers", { name: c.nome, cpfCnpj: c.cpfCnpj, email: c.email, externalReference: c.contaId });
    return r.id;
  }
  async criarCobranca(n: NovaCobranca) {
    const r = await this.chamar<{ id: string; invoiceUrl: string }>("/payments", {
      customer: n.clienteId,
      billingType: TIPO_ASAAS[n.metodo],
      value: Number(n.valor),
      dueDate: n.vencimento,
      description: n.descricao.slice(0, 500),
      externalReference: n.referenciaExterna,
    });
    return { id: r.id, link: r.invoiceUrl };
  }
}

/** O gateway configurado: Asaas com ASAAS_API_KEY; senão, simulação. */
export function cobranca(): Cobranca {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) return new CobrancaSimulada();
  const base = process.env.ASAAS_AMBIENTE === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  return new CobrancaAsaas(chave, base);
}

export function notaFiscal(): NotaFiscal {
  return { modo: "simulacao", emitir: async () => ({ url: null }) };
}

/** Traduz o evento do Asaas para o evento da Equapar (null = evento que não muda nada aqui). */
export function eventoAsaas(nome: string): EventoPagamento | null {
  if (nome === "PAYMENT_CONFIRMED" || nome === "PAYMENT_RECEIVED") return "PAGO";
  if (nome === "PAYMENT_OVERDUE") return "VENCIDO";
  if (nome === "PAYMENT_REFUNDED") return "ESTORNADO";
  if (nome === "PAYMENT_DELETED") return "CANCELADO";
  return null;
}

/** Confere o token do webhook (tempo constante). */
export function tokenWebhookValido(recebido: string | null, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
