"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atalho "/" foca a busca (no celular, abre a tela de busca). Ignorado enquanto se digita num campo. */
export function AtalhoBusca() {
  const router = useRouter();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      const campo = document.querySelector<HTMLInputElement>("#busca, #q");
      if (campo && campo.offsetParent !== null) campo.focus();
      else router.push("/app/busca");
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [router]);
  return null;
}
