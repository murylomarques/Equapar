import { describe, expect, it } from "vitest";
import { resumoOrgao } from "./historico-orgao";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const vazio = { protocoloData: null, respostaData: null, deferidoEm: null, apostiladoEm: null };

describe("5.4: histórico do órgão na conta", () => {
  it("conta feitos, deferidos e indeferidos e faz as médias de dias", () => {
    const r = resumoOrgao([
      { ...vazio, estado: "RECEBIDO", protocoloData: d("2026-01-01"), respostaData: d("2026-01-31"), deferidoEm: d("2026-01-31"), apostiladoEm: d("2026-03-02") },
      { ...vazio, estado: "INDEFERIDO", protocoloData: d("2026-02-01"), respostaData: d("2026-03-03") },
      { ...vazio, estado: "PROTOCOLADO", protocoloData: d("2026-10-01") },
      { ...vazio, estado: "EM_ANALISE" },
    ]);
    expect(r).toEqual({ feitos: 3, deferidos: 1, indeferidos: 1, diasAteResposta: 30, diasAteApostilamento: 30 });
  });
  it("sem pedidos, nada a mostrar", () => {
    expect(resumoOrgao([])).toEqual({ feitos: 0, deferidos: 0, indeferidos: 0, diasAteResposta: null, diasAteApostilamento: null });
  });
});
