import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { diasAte, hojeUTC, plural } from "@/lib/format";
import { FONTES } from "@/lib/prazos";
import { FonteRegra } from "@/components/fonte-regra";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { Decisao } from "./decisao";
import { RegistrarProrrogacao } from "./registrar";

export const metadata: Metadata = { title: "Decisão de prorrogação | Equapar" };

export default async function Prorrogacao({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const c = await db.contrato.findFirst({ where: { id, empresa: { contaId: ctx.conta.id } }, include: { convencao: true } });
  if (!c) notFound();
  const d = diasAte(c.vigenciaFim);
  const ano = c.convencao?.ano ?? hojeUTC().getUTCFullYear();
  const ressalva = `A CONTRATADA ressalva o direito à repactuação decorrente da convenção coletiva de ${ano}, ainda não depositada nesta data.`;
  const inicial = c.tipoReajuste === "INDICE" ? "indice" : c.convencao?.situacao === "REGISTRADA" ? "registrada" : c.convencao ? "pendente" : null;

  return (
    <div style={{ maxWidth: 1000 }}>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Carteira", href: "/app/carteira" },
          { rotulo: `Contrato ${c.numero}`, href: `/app/contratos/${c.id}` },
          { rotulo: "Decisão de prorrogação" },
        ]}
        titulo={d >= 0 ? `O contrato ${c.numero} termina em ${plural(d, "dia", "dias")}. Antes de assinar a prorrogação:` : `O contrato ${c.numero} terminou há ${plural(-d, "dia", "dias")}.`}
        subtitulo={c.orgao}
      />
      <Decisao contratoId={c.id} ressalva={ressalva} clausula={c.clausulaReajuste} inicial={inicial} podePedir={pode(ctx.papel, "editar_pedidos")} />
      {pode(ctx.papel, "editar_contratos") && <RegistrarProrrogacao contratoId={c.id} ressalvaSugerida={ressalva} fonte={FONTES.preclusao} />}
      <footer className="pilha-8 mt-32">
        <FonteRegra regra={FONTES.preclusao} />
        <FonteRegra regra={FONTES.ressalva} />
        <FonteRegra regra={FONTES.indice} />
      </footer>
    </div>
  );
}
