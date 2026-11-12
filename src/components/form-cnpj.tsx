"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cnpjValido, soDigitos } from "@/lib/cnpj";

/** Campo do Raio-X: aceita colar com ou sem pontos. */
export function FormCnpj({ id = "cnpj", valorInicial = "" }: { id?: string; valorInicial?: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(valorInicial);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      action="/raio-x"
      method="get"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const d = soDigitos(valor);
        if (!cnpjValido(d)) {
          setErro("Esse CNPJ não existe. Confira os 14 números.");
          return;
        }
        setErro("");
        setEnviando(true);
        router.push(`/raio-x?cnpj=${d}`);
      }}
    >
      <label htmlFor={id} className="rotulo" style={{ display: "block", marginBottom: 6 }}>
        CNPJ da empresa
      </label>
      <div className="form-cnpj">
        <input
          id={id}
          name="cnpj"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={!!erro}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
        <button className="btn btn-primario" type="submit" disabled={enviando}>
          {enviando ? "Consultando…" : "Ver meus contratos"}
        </button>
      </div>
      {erro && (
        <p id={`${id}-erro`} className="erro-texto mt-0" style={{ marginTop: 8 }} role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
