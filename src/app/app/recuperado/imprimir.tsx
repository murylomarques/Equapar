"use client";
import { Printer } from "lucide-react";

export function BotaoImprimir() {
  return (
    <button type="button" className="btn nao-imprimir" onClick={() => window.print()}>
      <Printer size={16} strokeWidth={1.5} aria-hidden /> Imprimir ou salvar em PDF
    </button>
  );
}
