"use client";
import { Copy } from "lucide-react";
import { useToast } from "./ui/provedores";

export function Copiar({ texto, rotulo = "Copiar texto" }: { texto: string; rotulo?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          toast("Texto copiado.");
        } catch {
          toast("Não deu para copiar automaticamente. Selecione o texto e copie com Ctrl+C.", { tipo: "erro" });
        }
      }}
    >
      <Copy size={16} strokeWidth={1.5} aria-hidden /> {rotulo}
    </button>
  );
}
