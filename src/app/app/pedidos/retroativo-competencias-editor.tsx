"use client";

import { useRef, useState } from "react";
import type { CompetenciaRetroativo } from "@/lib/retroativo-competencias";

type Linha = CompetenciaRetroativo & { chave: string };

const vazia = (chave: string): Linha => ({ chave, competencia: "", diferencaMensal: "", dias: 30, divisor: 30, base: "", periodo: "" });

export function RetroativoCompetenciasEditor({ inicial, somenteLeitura }: { inicial: CompetenciaRetroativo[]; somenteLeitura: boolean }) {
  const sequencia = useRef(inicial.length);
  const [linhas, setLinhas] = useState<Linha[]>(() => inicial.map((linha, i) => ({ ...linha, chave: `inicial-${i}` })));
  const alterar = (chave: string, campo: keyof CompetenciaRetroativo, valor: string | number) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
  const adicionar = () => {
    const chave = `nova-${sequencia.current++}`;
    setLinhas((atuais) => [...atuais, vazia(chave)]);
  };

  return (
    <fieldset className="pilha" style={{ gap: 12 }} disabled={somenteLeitura}>
      <legend>Competências com base ou valor diferente</legend>
      <p className="ajuda-texto mb-0">
        Use somente quando o período tiver bases diferentes. Cada competência é calculada e arredondada separadamente; sem linhas, vale a diferença mensal da planilha.
      </p>
      <input
        type="hidden"
        name="retroativoCompetencias"
        value={JSON.stringify(
          linhas
            .map((linha) => ({ competencia: linha.competencia, diferencaMensal: linha.diferencaMensal, dias: linha.dias, divisor: linha.divisor, base: linha.base, periodo: linha.periodo }))
            .filter((linha) => linha.competencia || linha.diferencaMensal),
        )}
      />
      {linhas.map((linha, i) => (
        <div className="cartao" key={linha.chave}>
          <div className="linha-form">
            <label>
              Competência
              <input type="month" value={linha.competencia} onChange={(e) => alterar(linha.chave, "competencia", e.target.value)} aria-label={`Competência ${i + 1}`} />
            </label>
            <label>
              Diferença mensal (R$)
              <input inputMode="decimal" value={linha.diferencaMensal} onChange={(e) => alterar(linha.chave, "diferencaMensal", e.target.value)} aria-label={`Diferença mensal da competência ${i + 1}`} />
            </label>
            <label>
              Dias
              <input type="number" min={1} max={31} value={linha.dias} onChange={(e) => alterar(linha.chave, "dias", Number(e.target.value))} aria-label={`Dias da competência ${i + 1}`} />
            </label>
            <label>
              Divisor
              <input type="number" min={1} max={31} value={linha.divisor} onChange={(e) => alterar(linha.chave, "divisor", Number(e.target.value))} aria-label={`Divisor da competência ${i + 1}`} />
            </label>
          </div>
          <div className="linha-form">
            <label>
              Base aplicada
              <input value={linha.base ?? ""} onChange={(e) => alterar(linha.chave, "base", e.target.value)} placeholder="CCT 2026, salário mínimo..." />
            </label>
            <label>
              Período observado
              <input value={linha.periodo ?? ""} onChange={(e) => alterar(linha.chave, "periodo", e.target.value)} placeholder="01/05 a 31/05" />
            </label>
          </div>
          <button type="button" className="botao botao-secundario" onClick={() => setLinhas((atuais) => atuais.filter((x) => x.chave !== linha.chave))}>
            Remover competência
          </button>
        </div>
      ))}
      <button type="button" className="botao botao-secundario" onClick={adicionar}>
        Adicionar competência diferente
      </button>
    </fieldset>
  );
}
