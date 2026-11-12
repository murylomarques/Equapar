"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { erroCnpj, mascaraCnpj, soDigitos } from "@/lib/mascaras";

/**
 * Campo do Raio-X: aceita colar em qualquer formato, mostra a máscara,
 * valida ao sair do campo (nunca enquanto digita) e ao enviar.
 */
export function FormCnpj({ id, valorInicial = "", escuro }: { id?: string; valorInicial?: string; escuro?: boolean }) {
  const router = useRouter();
  const auto = useId();
  const campoId = id ?? `cnpj-${auto.replace(/:/g, "")}`;
  const [valor, setValor] = useState(mascaraCnpj(valorInicial));
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const valido = soDigitos(valor).length === 14 && !erroCnpj(valor);
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
        router.push(`/raio-x?cnpj=${soDigitos(valor)}`);
        window.setTimeout(() => setEnviando(false), 1500);
      }}
    >
      <label htmlFor={campoId} className="rotulo" style={{ display: "block", marginBottom: 6, color: escuro ? "#fff" : undefined }}>
        CNPJ da empresa
      </label>
      <div className="form-cnpj">
        <div className="entrada" style={{ flex: "1 1 240px" }}>
          <input
            id={campoId}
            name="cnpj"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            value={valor}
            className="tnum"
            onChange={(e) => {
              setValor(mascaraCnpj(e.target.value));
              if (erro) setErro("");
            }}
            onBlur={() => {
              if (soDigitos(valor).length) setErro(erroCnpj(valor) ?? "");
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
        <p id={`${campoId}-erro`} className="erro-texto" style={{ marginTop: 8, color: escuro ? "#ffb4a0" : undefined }} role="alert">
          <AlertCircle size={16} strokeWidth={1.5} aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
          {erro}
        </p>
      )}
    </form>
  );
}
