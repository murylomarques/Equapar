import { describe, expect, it } from "vitest";
import { acoesDoContrato, contratosComPrazoEm, oportunidade } from "./prazos";

const hoje = new Date(Date.UTC(2026, 10, 12));
const dia = (n: number) => new Date(hoje.getTime() + n * 86_400_000);
// Contrato cujo próximo prazo é a data-base da convenção daqui a ~20 dias (sem ação "Precisa de você")
const conv = { id: "cv", contaId: "a", nome: "CCT", mesDataBase: 12, situacao: "REGISTRADA", dataDeposito: dia(-300) } as never;
const contrato = (id: string, fim: Date) =>
  ({ id, numero: id, orgao: "Órgão", vigenciaInicio: dia(-400), vigenciaFim: fim, tipoReajuste: "REPACTUACAO", maoDeObraDedicada: true, convencao: conv, convencaoId: "cv", pedidos: [], ultimoApostilamento: null, dataProposta: dia(-420) }) as never;

describe("L1: um conjunto só de contratos com prazo", () => {
  const cs = [contrato("A", dia(400)), contrato("B", dia(15)), contrato("C", dia(200))];
  it("conta contratos cujo próximo prazo (qualquer tipo) cai nos próximos N dias", () => {
    // os três têm a data-base da convenção em 01/12/2026 (daqui a 19 dias)
    expect(contratosComPrazoEm(cs, 30, hoje)).toHaveLength(3);
    expect(contratosComPrazoEm(cs, 7, hoje)).toHaveLength(0);
  });
  it("antes: o cartão contava ações e o filtro contava contratos, e os números divergiam", () => {
    const acoes30 = cs.flatMap((c) => acoesDoContrato(c, hoje)).filter((a) => a.limite && (a.limite.getTime() - hoje.getTime()) / 86_400_000 <= 30).length;
    const filtro30 = contratosComPrazoEm(cs, 30, hoje).length;
    expect(acoes30).not.toBe(filtro30); // a divergência que o L1 elimina: agora os dois usam contratosComPrazoEm
  });
});

describe("5.1: o pedido da jornada não esconde a repactuação da convenção", () => {
  it("convenção nova a pedir continua aparecendo com um pedido de jornada aberto", () => {
    const c = contrato("J", dia(400)) as unknown as { pedidos: unknown[] };
    const base = oportunidade(c as never, dia(30));
    expect(base).not.toBeNull();
    c.pedidos = [{ id: "pj", estado: "EM_ANALISE", gatilho: "JORNADA_EC141", dataBase: dia(34) }];
    const comJornada = oportunidade(c as never, dia(30));
    expect(comJornada?.pedidoAberto).toBeNull();
  });
});
