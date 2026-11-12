"use client";
import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Acao, Resultado } from "@/lib/acao";

/** "Arraste a planilha de custos da proposta ou do último apostilamento (Excel ou PDF)." */
export function ZonaArquivo({ action, pedidoId, texto, accept }: { action: Acao; pedidoId: string; texto: string; accept: string }) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(action, {});
  const [arrastando, setArrastando] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={acao}>
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <div
        className={`zona-arquivo${arrastando ? " arrastando" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (e.dataTransfer.files.length && input.current) {
            input.current.files = e.dataTransfer.files;
            form.current?.requestSubmit();
          }
        }}
      >
        <Upload size={24} strokeWidth={1.5} aria-hidden />
        <p style={{ margin: "8px 0" }}>{texto}</p>
        <label className="btn" style={{ cursor: "pointer" }}>
          {pendente ? "Lendo a planilha…" : "Escolher arquivo"}
          <input
            ref={input}
            type="file"
            name="arquivo"
            accept={accept}
            className="sr-only"
            disabled={pendente}
            onChange={() => form.current?.requestSubmit()}
          />
        </label>
      </div>
      <div aria-live="polite">
        {estado.erro && (
          <p className="erro-texto" role="alert">
            {estado.erro}
          </p>
        )}
        {estado.ok && <p className="salvo">{estado.ok}</p>}
      </div>
    </form>
  );
}
