"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="cartao" role="alert">
      <h1>Não deu certo</h1>
      <p className="secundario">
        {process.env.NODE_ENV === "development" ? error.message : "Algo falhou ao carregar esta tela. Tente de novo; se continuar, fale com o suporte."}
        {error.digest && <span className="legenda"> (código {error.digest})</span>}
      </p>
      <button className="btn" type="button" onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}
