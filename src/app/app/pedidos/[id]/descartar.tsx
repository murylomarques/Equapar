"use client";
import { Trash2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { useConfirmar } from "@/components/ui/provedores";
import type { Resultado } from "@/lib/acao";
import { descartarPedido } from "../acoes";

export function ItemDescartar({ id }: { id: string }) {
  const confirmar = useConfirmar();
  const [estado, despachar] = useActionState<Resultado, FormData>(descartarPedido, {});
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className="perigo"
        onClick={async () => {
          const ok = await confirmar({
            titulo: "Descartar este pedido?",
            texto: "O que foi preenchido e os anexos do pedido serão apagados. O contrato continua na carteira.",
            confirmar: "Descartar pedido",
            perigo: true,
          });
          if (!ok) return;
          const fd = new FormData();
          fd.set("pedidoId", id);
          startTransition(() => despachar(fd));
        }}
      >
        <Trash2 size={16} strokeWidth={1.5} aria-hidden /> Descartar pedido
      </button>
      {estado.erro && (
        <p className="erro-texto" role="alert" style={{ padding: "4px 10px" }}>
          {estado.erro}
        </p>
      )}
    </>
  );
}
