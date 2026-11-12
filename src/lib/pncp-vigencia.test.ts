import { describe, expect, it } from "vitest";
import { vigenciaAoImportar } from "./pncp-vigencia";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("L4: Atualizar do PNCP não apaga a vigência editada à mão", () => {
  it("não editada (igual ao último valor do PNCP): acompanha o PNCP", () => {
    expect(vigenciaAoImportar({ vigenciaFim: d("2026-11-30"), vigenciaFimPncp: d("2026-11-30") }, d("2027-11-30"))).toEqual({ vigenciaFim: d("2027-11-30"), vigenciaFimPncp: d("2027-11-30") });
  });
  it("editada à mão: guarda o valor do PNCP e mantém o da pessoa (antes: sobrescrevia)", () => {
    expect(vigenciaAoImportar({ vigenciaFim: d("2027-11-30"), vigenciaFimPncp: d("2026-11-30") }, d("2026-11-30"))).toEqual({ vigenciaFimPncp: d("2026-11-30") });
  });
  it("contrato antigo sem valor do PNCP guardado e data diferente: trata como editada", () => {
    expect(vigenciaAoImportar({ vigenciaFim: d("2027-11-30"), vigenciaFimPncp: null }, d("2026-11-30"))).toEqual({ vigenciaFimPncp: d("2026-11-30") });
  });
  it("contrato antigo sem valor guardado e mesma data: só guarda", () => {
    expect(vigenciaAoImportar({ vigenciaFim: d("2026-11-30"), vigenciaFimPncp: null }, d("2026-11-30"))).toEqual({ vigenciaFimPncp: d("2026-11-30") });
  });
});
