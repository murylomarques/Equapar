"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/**
 * Indicador com tempo certo (P9/P10): só aparece se a espera passar de `atraso` ms
 * e, uma vez visível, fica pelo menos `minimo` ms, para não piscar.
 */
export function useIndicador(ativo: boolean, atraso = 400, minimo = 500) {
  const [visivel, setVisivel] = useState(false);
  const desde = useRef(0);
  useEffect(() => {
    if (ativo) {
      const t = window.setTimeout(() => {
        desde.current = Date.now();
        setVisivel(true);
      }, atraso);
      return () => window.clearTimeout(t);
    }
    if (!visivel) return;
    const resta = Math.max(0, minimo - (Date.now() - desde.current));
    const t = window.setTimeout(() => setVisivel(false), resta);
    return () => window.clearTimeout(t);
  }, [ativo, atraso, minimo, visivel]);
  return visivel;
}

export function Spinner({ grande, rotulo }: { grande?: boolean; rotulo?: string }) {
  return <span className={`spinner${grande ? " spinner-g" : ""}`} role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true} />;
}

/** Spinner com texto específico, para ações de 2 a 10 s, anunciado a leitores de tela. */
export function Carregando({ texto, ativo = true }: { texto: string; ativo?: boolean }) {
  const visivel = useIndicador(ativo, 300);
  return (
    <div role="status" aria-live="polite" className="fileira secundario" style={{ minHeight: 24 }}>
      {visivel && (
        <>
          <Spinner /> {texto}
        </>
      )}
    </div>
  );
}

/** Etapas reais de uma espera longa (> 10 s): concluídas com ✓, a atual com spinner. */
export function EtapasProgresso({ etapas, atual }: { etapas: string[]; atual: number }) {
  return (
    <ol className="etapas-progresso" aria-live="polite">
      {etapas.map((e, i) => (
        <li key={e} className={i < atual ? "feita" : i === atual ? "atual" : undefined}>
          {i < atual ? <Check size={16} strokeWidth={2} aria-hidden /> : i === atual ? <Spinner /> : <span style={{ width: 16 }} aria-hidden />}
          <span>
            {e}
            {i < atual && <span className="sr-only"> (concluído)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
