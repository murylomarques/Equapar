"use client";
import { useTransition } from "react";
import { selecionarEmpresa } from "./acoes";

/** Seletor de cliente da assessoria. Vazio = "Todos os clientes". */
export function SeletorEmpresa({ empresas, atual }: { empresas: { id: string; nome: string }[]; atual: string | null }) {
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <label htmlFor="seletor-empresa" className="sr-only">
        Cliente
      </label>
      <select
        id="seletor-empresa"
        value={atual ?? ""}
        disabled={pendente}
        onChange={(e) => iniciar(() => selecionarEmpresa(e.target.value || null))}
        style={{ maxWidth: 220, minHeight: 36, fontSize: 14 }}
      >
        <option value="">Todos os clientes</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </>
  );
}
