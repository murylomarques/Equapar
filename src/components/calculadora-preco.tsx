"use client";
import { useState } from "react";

/** Postos × R$ 4, com mínimo de R$ 297 (preço da página de preços, em teste). */
export function CalculadoraPreco() {
  const [postos, setPostos] = useState("120");
  const n = Number(postos.replace(/\D/g, "")) || 0;
  const valor = Math.max(297, n * 4);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  return (
    <div className="cartao" style={{ maxWidth: 520 }}>
      <h2>Quanto fica a Carteira para a sua empresa</h2>
      <div className="campo">
        <label htmlFor="calc-postos">Postos de trabalho nos contratos públicos</label>
        <div className="entrada com-sufixo" style={{ maxWidth: 220 }}>
          <input id="calc-postos" inputMode="numeric" className="valor-num" value={postos} onChange={(e) => setPostos(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="calc-resultado" />
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
        <span className="ajuda-texto" style={{ display: "block" }}>
          {n * 4 < 297 ? `${n} × R$ 4 = ${fmt(n * 4)}; vale o mínimo de R$ 297.` : `${n.toLocaleString("pt-BR")} × R$ 4 por posto.`}
        </span>
      </p>
    </div>
  );
}
