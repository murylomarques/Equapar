"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selecionarEmpresa } from "../acoes";

export function BotaoCliente({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-pequeno"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await selecionarEmpresa(id);
          router.push("/app/carteira");
        })
      }
    >
      Abrir carteira
    </button>
  );
}
