"use client";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
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

/** Estado vazio: leva ao formulário logo abaixo e põe o cursor no CNPJ (o botão principal é o do formulário). */
export function BotaoIrParaFormulario({ alvo, campo, children }: { alvo: string; campo: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${alvo}`}
      className="btn"
      onClick={(e) => {
        const secao = document.getElementById(alvo);
        if (!secao) return;
        e.preventDefault();
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
        secao.querySelector<HTMLInputElement>(`[name="${campo}"]`)?.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}

/** Depois do cadastro, a página chega com a rolagem do formulário anterior: começa do topo. */
export function ComecarDoTopo() {
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);
  return null;
}
