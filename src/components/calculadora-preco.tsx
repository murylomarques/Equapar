"use client";
import { useState } from "react";
import { PRECOS } from "@/lib/planos";

/** Postos × preço por posto, com o mínimo mensal: os mesmos números da cobrança (lib/planos.ts). */
export function CalculadoraPreco() {
  const [postos, setPostos] = useState("120");
  const n = Number(postos.replace(/\D/g, "")) || 0;
  const { carteiraPorPosto: porPosto, carteiraMinimo: minimo } = PRECOS;
  const valor = Math.max(minimo, n * porPosto);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  return (
    <div className="cartao">
      <h2>Quanto fica a Carteira para a sua empresa</h2>
      <div className="campo">
        <label htmlFor="calc-postos">Postos de trabalho nos contratos públicos</label>
        <div className="entrada com-sufixo" style={{ maxWidth: 240 }}>
          <input id="calc-postos" inputMode="numeric" className="tnum" style={{ textAlign: "left", fontSize: 18 }} value={postos} onChange={(e) => setPostos(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="calc-resultado" />
          <span className="sufixo" aria-hidden>
            postos
          </span>
        </div>
      </div>
      <p id="calc-resultado" aria-live="polite" className="mb-0">
        <span style={{ fontFamily: "var(--fonte-serif)", fontSize: 34, lineHeight: "40px" }} className="tnum">
          {fmt(valor)}
        </span>{" "}
        por mês
        <span className="ajuda-texto" style={{ display: "block", marginTop: 4 }}>
          {n * porPosto < minimo ? `${n} × ${fmt(porPosto)} = ${fmt(n * porPosto)}; vale o mínimo de ${fmt(minimo)}.` : `${n.toLocaleString("pt-BR")} × ${fmt(porPosto)} por posto.`}
        </span>
      </p>
    </div>
  );
}
