"use client";
import { useActionState, useEffect, useRef } from "react";
import type { Acao, Resultado } from "@/lib/acao";

/** Formulário ligado a uma ação de servidor; mostra o erro (ou a confirmação) em texto, junto ao formulário. */
export function FormAcao({
  action,
  children,
  className,
  style,
  limparAoSalvar,
  confirmar,
  id,
  encType,
}: {
  action: Acao;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  limparAoSalvar?: boolean;
  confirmar?: string;
  id?: string;
  encType?: string;
}) {
  const [estado, acao] = useActionState<Resultado, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && limparAoSalvar) ref.current?.reset();
  }, [estado, limparAoSalvar]);
  return (
    <form
      ref={ref}
      id={id}
      action={acao}
      className={className}
      style={style}
      encType={encType}
      noValidate
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      {estado.erro && (
        <p className="erro-texto" role="alert" style={{ marginTop: 8, marginBottom: 0 }}>
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="salvo" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
          {estado.ok}
        </p>
      )}
    </form>
  );
}
