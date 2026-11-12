import { describe, expect, it } from "vitest";
import { riscoPreclusao } from "./prorrogacao";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const contrato = (pedidos: { estado: string; protocoloData: Date | null }[], dataDeposito: Date | null = d("2026-02-10")) => ({ convencao: dataDeposito ? { dataDeposito } : null, pedidos });

describe("L17: alerta de preclusão ao registrar a prorrogação", () => {
  it("sem pedido e sem ressalva, com convenção nova depositada antes do termo: alerta", () => {
    expect(riscoPreclusao({ dataTermo: d("2026-11-30"), comRessalva: false }, contrato([]))).toBe(true);
  });
  it("com ressalva: sem alerta", () => {
    expect(riscoPreclusao({ dataTermo: d("2026-11-30"), comRessalva: true }, contrato([]))).toBe(false);
  });
  it("com pedido protocolado depois do depósito e antes do termo: sem alerta", () => {
    expect(riscoPreclusao({ dataTermo: d("2026-11-30"), comRessalva: false }, contrato([{ estado: "PROTOCOLADO", protocoloData: d("2026-10-01") }]))).toBe(false);
  });
  it("pedido só em análise (não protocolado) não protege: alerta", () => {
    expect(riscoPreclusao({ dataTermo: d("2026-11-30"), comRessalva: false }, contrato([{ estado: "EM_ANALISE", protocoloData: null }]))).toBe(true);
  });
  it("sem convenção depositada, ou depositada depois do termo: sem alerta", () => {
    expect(riscoPreclusao({ dataTermo: d("2026-11-30"), comRessalva: false }, contrato([], null))).toBe(false);
    expect(riscoPreclusao({ dataTermo: d("2026-01-15"), comRessalva: false }, contrato([]))).toBe(false);
  });
});
