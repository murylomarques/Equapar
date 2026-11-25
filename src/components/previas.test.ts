import { describe, expect, it } from "vitest";
import { calcularPlanilha, compararPlanilhas } from "@/lib/calculo/motor";
import { agora, antes } from "../../prisma/seed-demo";
import { MEMORIA_EXEMPLO, totaisMemoriaExemplo } from "./previas";

// A prévia da landing mostra os números da planilha fictícia da demonstração; nada inventado para fechar a conta.
describe("Prévia da memória de cálculo", () => {
  const c = (v: string) => Math.round(Number(v) * 100);
  it("cada posto confere com o motor de cálculo sobre o seed da demonstração", () => {
    const a = calcularPlanilha(antes);
    const b = calcularPlanilha(agora);
    for (const p of MEMORIA_EXEMPLO.postos) {
      const pa = a.postos.find((x) => x.nome === p.nome)!;
      const pb = b.postos.find((x) => x.nome === p.nome)!;
      expect([pa.quantidade, c(pa.valorPorPosto), c(pb.valorPorPosto)]).toEqual([p.quantidade, p.antes, p.agora]);
      const sal = (t: typeof pa) => c(t.linhas.find((l) => l.descricao === "Salário base")!.valor);
      expect([sal(pa), sal(pb)]).toEqual([p.pisoAntes, p.pisoAgora]);
    }
    expect(MEMORIA_EXEMPLO.postos.length).toBe(a.postos.length);
  });
  it("total e diferença iguais aos do pedido de exemplo", () => {
    const r = compararPlanilhas(antes, agora);
    const t = totaisMemoriaExemplo();
    expect([t.antes, t.agora, t.diferenca]).toEqual([c(r.mensalAntes), c(r.mensalAgora), c(r.diferencaMensal)]);
  });
});
