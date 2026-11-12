"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import type { Acao, Resultado } from "@/lib/acao";
import { useConfirmar, useToast } from "./ui/provedores";

interface CtxForm {
  pendente: boolean;
  campos: Record<string, string>;
}
const ContextoForm = createContext<CtxForm | null>(null);

/** Estado do formulário mais próximo (pendente e erros por campo). Fora de um FormAcao, usa useFormStatus. */
export function useFormulario() {
  const ctx = useContext(ContextoForm);
  const status = useFormStatus();
  return ctx ?? { pendente: status.pending, campos: {} };
}

export function useErroCampo(nome?: string) {
  const ctx = useContext(ContextoForm);
  return nome ? ctx?.campos[nome] : undefined;
}

/**
 * Formulário ligado a uma ação de servidor.
 * - Envio controlado: mantém o que foi digitado quando há erro (o React limparia o formulário).
 * - Erro geral e resumo de erros por campo no topo, com link para cada campo (foco vai para o resumo).
 * - Confirmação ("ok") vira toast; com `okNaPagina` aparece também abaixo do formulário.
 * - `confirmar`: pede confirmação numa janela antes de enviar.
 */
export function FormAcao({
  action,
  children,
  className,
  style,
  limparAoSalvar,
  confirmar,
  id,
  okNaPagina,
  semToast,
  aoConcluir,
}: {
  action: Acao;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  limparAoSalvar?: boolean;
  confirmar?: string | { titulo: string; texto?: string; confirmar?: string; perigo?: boolean; digitar?: string };
  id?: string;
  okNaPagina?: boolean;
  semToast?: boolean;
  aoConcluir?: (r: Resultado) => void;
}) {
  const [estado, despachar, pendente] = useActionState<Resultado, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const resumo = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const pedirConfirmacao = useConfirmar();
  const ultimo = useRef<Resultado | null>(null);

  useEffect(() => {
    if (estado === ultimo.current || (!estado.ok && !estado.erro)) return;
    ultimo.current = estado;
    if (estado.ok) {
      if (!semToast) toast(estado.ok);
      if (limparAoSalvar) ref.current?.reset();
    }
    if (estado.campos && Object.keys(estado.campos).length) resumo.current?.focus();
    aoConcluir?.(estado);
  }, [estado, limparAoSalvar, toast, semToast, aoConcluir]);

  const campos = estado.campos ?? {};
  const listaCampos = Object.entries(campos);

  return (
    <ContextoForm.Provider value={{ pendente, campos }}>
      <form
        ref={ref}
        id={id}
        className={className}
        style={style}
        noValidate
        aria-busy={pendente}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pendente) return; // sem envio duplo
          const form = e.currentTarget;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const fd = new FormData(form, submitter ?? undefined);
          if (confirmar) {
            const p = typeof confirmar === "string" ? { titulo: confirmar } : confirmar;
            if (!(await pedirConfirmacao(p))) return;
          }
          startTransition(() => despachar(fd));
        }}
      >
        {listaCampos.length > 0 ? (
          <div ref={resumo} tabIndex={-1} className="resumo-erros" role="alert">
            <h2>{listaCampos.length === 1 ? "Falta corrigir 1 campo" : `Falta corrigir ${listaCampos.length} campos`}</h2>
            <ul>
              {listaCampos.map(([nome, msg]) => (
                <li key={nome}>
                  <a
                    href={`#campo-${nome}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = ref.current?.querySelector<HTMLElement>(`[data-campo="${nome}"]`);
                      el?.focus();
                      el?.scrollIntoView({ block: "center" });
                    }}
                  >
                    {msg}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {children}
        {estado.erro && !listaCampos.length && (
          <p className="erro-texto" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>
            <AlertCircle size={16} strokeWidth={1.5} aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
            {estado.erro}
          </p>
        )}
        {okNaPagina && estado.ok && (
          <p className="salvo" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
            {estado.ok}
          </p>
        )}
      </form>
    </ContextoForm.Provider>
  );
}
