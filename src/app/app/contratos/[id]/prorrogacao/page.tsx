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
import { alertaJornadaNaProrrogacao, avaliarProrrogacao } from "@/lib/prorrogacao";
import { AlertaDeProrrogacao } from "@/components/alerta-prorrogacao";
import { JORNADA } from "@/lib/jornada";
import { jornadaVisivelPara } from "@/lib/jornada-acesso";

export const metadata: Metadata = { title: "Decisão de prorrogação | Equapar" };

export default async function Prorrogacao({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const c = await db.contrato.findFirst({ where: { id, empresa: { contaId: ctx.conta.id } }, include: { convencao: true, pedidos: true } });
  if (!c) notFound();
  const d = diasAte(c.vigenciaFim);
  const ano = c.convencao?.ano ?? hojeUTC().getUTCFullYear();
  // C2: modelo de ressalva (MINUTA até o advogado aprovar). Os colchetes são preenchidos pela empresa.
  const ressalva = `MINUTA, revise com seu jurídico: "Fica ressalvada a análise de eventual repactuação referente a [convenção coletiva de ${ano}, categoria e período], solicitada no protocolo [número e data], cuja instrução será complementada com [documentos pendentes]."`;
  const alerta = c.tipoReajuste === "REPACTUACAO" && c.maoDeObraDedicada ? avaliarProrrogacao({ dataTermo: null, comRessalva: false, hoje: hojeUTC() }, c) : null;
  const alertaJornada = jornadaVisivelPara(ctx.usuario.email) ? alertaJornadaNaProrrogacao(c, JORNADA.inicio42(), hojeUTC()) : null;
  const inicial = c.tipoReajuste === "INDICE" ? "indice" : c.convencao?.situacao === "REGISTRADA" ? "registrada" : c.convencao ? "pendente" : null;

  return (
    <div className="pagina-prorrogacao" style={{ maxWidth: 1000 }}>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Carteira", href: "/app/carteira" },
          { rotulo: `Contrato ${c.numero}`, href: `/app/contratos/${c.id}` },
          { rotulo: "Decisão de prorrogação" },
        ]}
        titulo={d >= 0 ? `O contrato ${c.numero} termina em ${plural(d, "dia", "dias")}` : `O contrato ${c.numero} terminou há ${plural(-d, "dia", "dias")}`}
        subtitulo={`${c.orgao} · Decida o caso abaixo antes de assinar a prorrogação.`}
      />
      {/* C5: alerta antes de assinar, com grau */}
      {alerta && <AlertaDeProrrogacao alerta={alerta} fonte={FONTES.preclusao} />}
      {/* D6: jornada (só para quem pode ver a jornada) */}
      {alertaJornada && <AlertaDeProrrogacao alerta={alertaJornada} fonte={JORNADA.fonte} />}
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
