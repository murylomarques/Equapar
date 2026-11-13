import { describe, expect, it } from "vitest";
import { alertaJornadaNaProrrogacao, avaliarProrrogacao, riscoPreclusao } from "./prorrogacao";

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


describe("C5: alerta de prorrogação com grau", () => {
  const hoje = d("2026-11-13");
  const c = (o: Partial<{ vigenciaFim: Date; dataDeposito: Date | null; mesDataBase: number | null; pedidos: { estado: string; protocoloData: Date | null }[]; semConvencao: boolean }> = {}) => ({
    vigenciaFim: o.vigenciaFim ?? d("2026-12-20"),
    convencao: o.semConvencao ? null : { dataDeposito: o.dataDeposito === undefined ? d("2026-02-10") : o.dataDeposito, mesDataBase: o.mesDataBase === undefined ? 1 : o.mesDataBase },
    pedidos: o.pedidos ?? [],
  });
  it("Confirmado: o caso que já existia (convenção depositada, sem pedido, sem ressalva)", () => {
    expect(avaliarProrrogacao({ dataTermo: d("2026-11-30"), comRessalva: false, hoje }, c())?.grau).toBe("Confirmado");
    expect(avaliarProrrogacao({ dataTermo: d("2026-11-30"), comRessalva: false, hoje }, c())?.mensagem).toBe("Revise antes de assinar: há repactuação a pedir.");
  });
  it("Provável: data-base passou, convenção nova não depositada, prorrogação a 60 dias ou menos", () => {
    const a = avaliarProrrogacao({ dataTermo: null, comRessalva: false, hoje }, c({ dataDeposito: null }));
    expect(a).toMatchObject({ grau: "Provável", mensagem: "Registre a solicitação e avalie a ressalva antes de assinar." });
  });
  it("prorrogação longe (mais de 60 dias) sem convenção nova: sem alerta", () => {
    expect(avaliarProrrogacao({ dataTermo: null, comRessalva: false, hoje }, c({ dataDeposito: null, vigenciaFim: d("2027-06-30") }))).toBeNull();
  });
  it("A conferir: faltam dados (sem convenção ou sem data-base)", () => {
    expect(avaliarProrrogacao({ dataTermo: null, comRessalva: false, hoje }, c({ semConvencao: true }))?.grau).toBe("A conferir");
    expect(avaliarProrrogacao({ dataTermo: null, comRessalva: false, hoje }, c({ mesDataBase: null }))?.mensagem).toBe("Faltam dados para avaliar o risco. Revise antes de assinar.");
  });
  it("com ressalva ou com pedido protocolado: sem alerta", () => {
    expect(avaliarProrrogacao({ dataTermo: d("2026-11-30"), comRessalva: true, hoje }, c())).toBeNull();
    expect(avaliarProrrogacao({ dataTermo: d("2026-11-30"), comRessalva: false, hoje }, c({ pedidos: [{ estado: "PROTOCOLADO", protocoloData: d("2026-10-01") }] }))).toBeNull();
  });
});

describe("D6: alerta de prorrogação na jornada", () => {
  const inicio = d("2026-12-16");
  it("etapa começou, mão de obra dedicada, sem pedido da jornada: Provável", () => {
    expect(alertaJornadaNaProrrogacao({ maoDeObraDedicada: true, pedidos: [] }, inicio, d("2027-01-10"))).toMatchObject({ grau: "Provável", mensagem: "Revise antes de assinar: a jornada mudou e não há pedido de reequilíbrio." });
  });
  it("antes da etapa, sem mão de obra dedicada ou com pedido da jornada: sem alerta", () => {
    expect(alertaJornadaNaProrrogacao({ maoDeObraDedicada: true, pedidos: [] }, inicio, d("2026-12-01"))).toBeNull();
    expect(alertaJornadaNaProrrogacao({ maoDeObraDedicada: false, pedidos: [] }, inicio, d("2027-01-10"))).toBeNull();
    expect(alertaJornadaNaProrrogacao({ maoDeObraDedicada: true, pedidos: [{ gatilho: "JORNADA_EC141", estado: "PROTOCOLADO" }] }, inicio, d("2027-01-10"))).toBeNull();
  });
});
