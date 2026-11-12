import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { diasAte, hojeUTC } from "@/lib/format";
import { FONTES } from "@/lib/prazos";
import { FonteRegra } from "@/components/fonte-regra";
import { Copiar } from "@/components/copiar";

export const metadata: Metadata = { title: "Decisão de prorrogação | Equapar" };

export default async function Prorrogacao({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const c = await db.contrato.findFirst({ where: { id, empresa: { contaId: ctx.conta.id } }, include: { convencao: true } });
  if (!c) notFound();
  const d = diasAte(c.vigenciaFim);
  const ano = c.convencao?.ano ?? hojeUTC().getUTCFullYear();
  const ressalva = `A CONTRATADA ressalva o direito à repactuação decorrente da convenção coletiva de ${ano}, ainda não depositada nesta data.`;
  const destaque = c.tipoReajuste === "INDICE" ? 3 : c.convencao?.situacao === "REGISTRADA" ? 1 : c.convencao ? 2 : 0;

  return (
    <div style={{ maxWidth: 820 }}>
      <p className="legenda mb-0">
        <Link href={`/app/contratos/${c.id}`}>Contrato {c.numero}</Link>
      </p>
      <h1>
        {d >= 0 ? `O contrato ${c.numero} termina em ${d} ${d === 1 ? "dia" : "dias"}.` : `O contrato ${c.numero} terminou há ${-d} dias.`} Antes de assinar a prorrogação:
      </h1>
      <div className="pilha mt-24">
        <section className="cartao" style={destaque === 1 ? { borderColor: "var(--verde)" } : undefined} aria-labelledby="op1">
          <h2 id="op1">A convenção nova já foi depositada</h2>
          <p>
            <strong>Peça a repactuação antes de assinar.</strong>
          </p>
          <Link href={`/app/pedidos/novo?contrato=${c.id}`} className="btn btn-primario">
            Montar pedido
          </Link>
        </section>
        <section className="cartao" style={destaque === 2 ? { borderColor: "var(--verde)" } : undefined} aria-labelledby="op2">
          <h2 id="op2">A convenção ainda não saiu</h2>
          <p>
            <strong>Assine com ressalva do direito à repactuação.</strong>
          </p>
          <blockquote className="documento" style={{ margin: "0 0 12px" }}>
            {ressalva}
          </blockquote>
          <div className="fileira">
            <Copiar texto={ressalva} />
            <span className="selo selo-ambar">revise com seu jurídico</span>
          </div>
        </section>
        <section className="cartao" style={destaque === 3 ? { borderColor: "var(--verde)" } : undefined} aria-labelledby="op3">
          <h2 id="op3">O contrato é reajustado por índice</h2>
          <p>
            <strong>Siga a cláusula de reajuste do contrato.</strong>
          </p>
          {c.clausulaReajuste ? (
            <details>
              <summary className="btn">Ver cláusula</summary>
              <blockquote className="documento" style={{ marginTop: 12 }}>
                {c.clausulaReajuste}
              </blockquote>
            </details>
          ) : (
            <Link href={`/app/contratos/${c.id}?aba=resumo`} className="btn">
              Ver cláusula
            </Link>
          )}
        </section>
      </div>
      <footer className="pilha-8 mt-24">
        <FonteRegra regra={FONTES.preclusao} />
        <FonteRegra regra={FONTES.ressalva} />
        <FonteRegra regra={FONTES.indice} />
      </footer>
    </div>
  );
}
