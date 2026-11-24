"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { erroCnpj, mascaraCnpj, normalizarCnpj } from "@/lib/mascaras";

/**
 * Campo da página do Raio-X: o mesmo comportamento de components/form-cnpj.tsx (máscara, validação ao sair do
 * campo e ao enviar) e, além dele, o erro que veio do servidor (?cnpj= inválido na URL) já aparece logo abaixo
 * do campo, com a borda de erro e aria-invalid.
 */
export function FormCnpj({ id, valorInicial = "", erroInicial = "" }: { id?: string; valorInicial?: string; erroInicial?: string }) {
  const router = useRouter();
  const auto = useId();
  const campoId = id ?? `cnpj-${auto.replace(/:/g, "")}`;
  const [valor, setValor] = useState(mascaraCnpj(valorInicial));
  const [erro, setErro] = useState(erroInicial);
  const [enviando, setEnviando] = useState(false);
  const valido = normalizarCnpj(valor).length === 14 && !erroCnpj(valor);
  return (
    <form
      action="/raio-x"
      method="get"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const msg = erroCnpj(valor);
        if (msg) {
          setErro(msg);
          document.getElementById(campoId)?.focus();
          return;
        }
        setErro("");
        setEnviando(true);
        router.push(`/raio-x?cnpj=${normalizarCnpj(valor)}`);
        window.setTimeout(() => setEnviando(false), 1500);
      }}
    >
      <label htmlFor={campoId} className="rotulo" style={{ display: "block", marginBottom: 6 }}>
        CNPJ da empresa
      </label>
      <div className="form-cnpj">
        <div className="entrada" style={{ flex: "1 1 240px" }}>
          <input
            id={campoId}
            name="cnpj"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            value={valor}
            className="tnum"
            onChange={(e) => {
              setValor(mascaraCnpj(e.target.value));
              if (erro) setErro("");
            }}
            onBlur={() => {
              if (normalizarCnpj(valor).length) setErro(erroCnpj(valor) ?? "");
            }}
            aria-invalid={!!erro}
            aria-describedby={erro ? `${campoId}-erro` : undefined}
          />
          {valido && <Check className="icone-ok" size={18} strokeWidth={2} aria-label="CNPJ válido" />}
        </div>
        <button className="btn btn-primario" type="submit" aria-busy={enviando}>
          {enviando ? (
            <>
              <span className="spinner" aria-hidden /> Abrindo…
            </>
          ) : (
            "Ver meus contratos"
          )}
        </button>
      </div>
      {erro && (
        <p id={`${campoId}-erro`} className="erro-texto" style={{ marginTop: 8 }} role="alert">
          <AlertCircle size={16} strokeWidth={1.5} aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
          {erro}
        </p>
      )}
    </form>
  );
}
