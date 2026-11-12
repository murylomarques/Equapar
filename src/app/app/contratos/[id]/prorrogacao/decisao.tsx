"use client";
import Link from "next/link";
import { useState } from "react";
import { Copiar } from "@/components/copiar";
import { Termo } from "@/components/ui/estrutura";

export function Decisao({
  contratoId,
  ressalva,
  clausula,
  inicial,
  podePedir,
}: {
  contratoId: string;
  ressalva: string;
  clausula: string | null;
  inicial: "registrada" | "pendente" | "indice" | null;
  podePedir: boolean;
}) {
  const [caso, setCaso] = useState(inicial);
  const opcoes = [
    { v: "registrada" as const, t: "A convenção nova já foi depositada", d: "Registrada no sistema Mediador do Ministério do Trabalho." },
    { v: "pendente" as const, t: "A convenção ainda não saiu", d: "Os sindicatos ainda negociam ou o depósito não aconteceu." },
    { v: "indice" as const, t: "O contrato é reajustado por índice", d: "IPCA, IST ou outro índice previsto em cláusula." },
  ];
  return (
    <div className="grade-2" style={{ alignItems: "start" }}>
      <fieldset className="grupo-form" style={{ margin: 0 }}>
        <legend className="rotulo" style={{ marginBottom: 8 }}>
          Qual é o caso deste contrato?
        </legend>
        <div className="radios-cartao">
          {opcoes.map((o) => (
            <label key={o.v} className="radio-cartao">
              <input type="radio" name="caso" value={o.v} checked={caso === o.v} onChange={() => setCaso(o.v)} />
              <span>
                <strong>{o.t}</strong>
                <span className="desc">{o.d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <section className="cartao" aria-live="polite" aria-label="O que fazer">
        {!caso && <p className="secundario mb-0">Escolha o caso ao lado para ver o que fazer.</p>}
        {caso === "registrada" && (
          <>
            <h2>
              Peça a <Termo>repactuação</Termo> antes de assinar
            </h2>
            <p className="secundario">Se a prorrogação for assinada sem o pedido, o direito à repactuação se perde (<Termo>preclusão</Termo>).</p>
            {podePedir && (
              <Link href={`/app/pedidos/novo?contrato=${contratoId}`} className="btn btn-primario">
                Montar pedido
              </Link>
            )}
          </>
        )}
        {caso === "pendente" && (
          <>
            <h2>
              Assine com <Termo>ressalva</Termo> do direito
            </h2>
            <p className="secundario">Inclua no termo aditivo o texto abaixo. Assim o direito fica preservado até a convenção sair.</p>
            <blockquote className="documento" style={{ margin: "0 0 12px" }}>
              {ressalva}
            </blockquote>
            <div className="fileira">
              <Copiar texto={ressalva} />
              <span className="selo selo-ambar">revise com seu jurídico</span>
            </div>
          </>
        )}
        {caso === "indice" && (
          <>
            <h2>Siga a cláusula de reajuste do contrato</h2>
            <p className="secundario">Reajuste por índice tem regra própria; a preclusão do TCU trata da repactuação.</p>
            {clausula ? (
              <blockquote className="documento" style={{ margin: 0 }}>
                {clausula}
              </blockquote>
            ) : (
              <Link href={`/app/contratos/${contratoId}?editar=1`} className="btn">
                Informar a cláusula
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
