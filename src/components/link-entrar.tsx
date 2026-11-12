"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** "Entrar" ou, para quem já tem sessão, "Abrir a Equapar". Checado no navegador para o site continuar estático. */
export function LinkEntrar() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/sessao", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d?.logado && setLogado(true))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return logado ? (
    <Link href="/app/hoje" className="btn btn-texto">
      Abrir a Equapar
    </Link>
  ) : (
    <Link href="/entrar" className="btn btn-texto">
      Entrar
    </Link>
  );
}
