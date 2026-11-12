"use client";
import { Archive } from "lucide-react";
import { startTransition, useActionState } from "react";
import { useConfirmar } from "@/components/ui/provedores";
import type { Resultado } from "@/lib/acao";
import { arquivarContrato } from "../../acoes";

/** Item "Arquivar contrato" do menu "⋯", com confirmação. */
export function ItemArquivar({ id, numero }: { id: string; numero: string }) {
  const confirmar = useConfirmar();
  const [estado, despachar] = useActionState<Resultado, FormData>(arquivarContrato, {});
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className="perigo"
        onClick={async () => {
          const ok = await confirmar({
            titulo: `Arquivar o contrato ${numero}?`,
            texto: "Ele sai da carteira, dos prazos e dos avisos. Os pedidos e documentos continuam guardados.",
            confirmar: "Arquivar",
            perigo: true,
          });
          if (!ok) return;
          const fd = new FormData();
          fd.set("id", id);
          startTransition(() => despachar(fd));
        }}
      >
        <Archive size={16} strokeWidth={1.5} aria-hidden /> Arquivar contrato
      </button>
      {estado.erro && (
        <p className="erro-texto" role="alert" style={{ padding: "4px 10px" }}>
          {estado.erro}
        </p>
      )}
    </>
  );
}
