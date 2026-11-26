import { describe, expect, it } from "vitest";
import { contaSoConsulta, pode, podeNaConta } from "./auth-papeis";

// 4.2: conta só para consulta por falta de pagamento. A tela esconde o que o servidor (exigir) recusaria.
const passou = new Date(Date.now() - 86_400_000);
const emDia = { situacaoCobranca: "EM_DIA", carenciaAte: null };
const soConsulta = { situacaoCobranca: "CARENCIA", carenciaAte: passou };

describe("podeNaConta: papel e situação da cobrança", () => {
  it("carência vencida = só para consulta; dentro da carência, não", () => {
    expect(contaSoConsulta(soConsulta)).toBe(true);
    expect(contaSoConsulta({ situacaoCobranca: "CARENCIA", carenciaAte: new Date(Date.now() + 86_400_000) })).toBe(false);
    expect(contaSoConsulta(emDia)).toBe(false);
  });
  it("só para consulta: ver e gerenciar a conta (pagar, exportar) continuam; editar some", () => {
    const dono = { papel: "DONO" as const, conta: soConsulta };
    expect(podeNaConta(dono, "ver")).toBe(true);
    expect(podeNaConta(dono, "gerenciar_conta")).toBe(true);
    expect(podeNaConta(dono, "editar_pedidos")).toBe(false);
    expect(podeNaConta(dono, "editar_contratos")).toBe(false);
  });
  it("em dia: o mesmo que o papel permite (Leitura não monta pedido)", () => {
    for (const papel of ["DONO", "GERENTE", "CONTADOR", "LEITURA"] as const)
      expect(podeNaConta({ papel, conta: emDia }, "editar_pedidos")).toBe(pode(papel, "editar_pedidos"));
    expect(podeNaConta({ papel: "LEITURA", conta: emDia }, "editar_pedidos")).toBe(false);
  });
});
