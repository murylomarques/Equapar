import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, pct } from "@/lib/calculo/motor";
import { calcularPedido } from "@/lib/pedido";
import { data, dataHora, dataLocal, MESES } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { Alerta, CabecalhoPagina } from "@/components/ui/estrutura";
import { aprovarMemoria } from "../../acoes";
import { MemoriaView } from "./memoria-view";

export const metadata: Metadata = { title: "Memória de cálculo | Equapar" };

export default async function Memoria({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const p = await pedidoDaConta(ctx, id);
  const calc = calcularPedido(p);
  const comp = calc.comparacao;
  const comentarios = await db.comentarioLinha.findMany({ where: { pedidoId: p.id }, include: { usuario: true }, orderBy: { criadoEm: "asc" } });
  const docConvencao = p.convencaoId ? await db.documento.findFirst({ where: { convencaoId: p.convencaoId }, orderBy: { criadoEm: "desc" } }) : null;
  const editavel = ["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado);
  const podeAprovar = pode(ctx.papel, "aprovar_memoria");

  return (
    <>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Pedidos", href: "/app/pedidos" },
          { rotulo: `Contrato ${p.contrato.numero}`, href: `/app/contratos/${p.contrato.id}` },
          { rotulo: "Pedido", href: p.estado === "EM_ANALISE" ? `/app/pedidos/${p.id}/passo/5` : `/app/pedidos/${p.id}/pronto` },
          { rotulo: "Memória de cálculo" },
        ]}
        titulo="Memória de cálculo"
        subtitulo={`Contrato ${p.contrato.numero} · ${p.contrato.orgao} · estrutura da IN SEGES/MP 05/2017, Anexo VII-D · regra ${calc.versaoRegra} · cada linha arredondada a 2 casas · tributos por dentro`}
        acao={
          p.memoriaAprovadaEm ? (
            <span className="selo selo-verde">
              <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden /> Aprovada por {p.memoriaAprovadaPor} em {dataLocal(p.memoriaAprovadaEm)}
            </span>
          ) : podeAprovar && editavel && calc.pronto ? (
            <FormAcao
              action={aprovarMemoria}
              confirmar={{
                titulo: "Aprovar a memória de cálculo?",
                texto: `Fica registrado que ${ctx.usuario.nome} conferiu a conta em ${dataHora(new Date())}. Se a planilha mudar depois, a aprovação é desfeita.`,
                confirmar: "Aprovar memória",
              }}
            >
              <input type="hidden" name="pedidoId" value={p.id} />
              <BotaoEnvio>Aprovar memória</BotaoEnvio>
            </FormAcao>
          ) : (
            <span className="selo selo-ambar">Aprovação: só Contador ou Dono</span>
          )
        }
      />

      {!comp || comp.erros.length ? (
        <Alerta tipo="erro" titulo="A memória ainda não pode ser montada">
          <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>
            {comp?.erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Link href={`/app/pedidos/${p.id}/passo/3`}>Voltar ao passo 3</Link>
        </Alerta>
      ) : (
        <>
          <div className="memoria-topo">
            <div>
              <span className="legenda">Diferença por mês</span>
              <strong className="tnum">{brl(comp.diferencaMensal)}</strong>
              <span className="legenda">
                {brl(comp.mensalAntes)} → {brl(comp.mensalAgora)} {comp.variacaoPct && `(+${pct(comp.variacaoPct)})`}
              </span>
            </div>
            <div>
              <span className="legenda">
                Desde a data-base ({p.dataBase ? `${MESES[p.dataBase.getUTCMonth()]} de ${p.dataBase.getUTCFullYear()}` : "não informada"})
              </span>
              <strong className="tnum">{calc.retroativo ? brl(calc.retroativo.total) : "—"}</strong>
              <span className="legenda">até {data(calc.dataReferencia)}</span>
            </div>
          </div>
          <MemoriaView
            pedidoId={p.id}
            comp={comp}
            retro={calc.retroativo}
            podeComentar={ctx.papel !== "LEITURA"}
            linkConvencao={docConvencao ? `/api/documentos/${docConvencao.id}` : null}
            comentarios={comentarios.map((c) => ({ id: c.id, linhaId: c.linhaId, autor: c.usuario.nome, quando: dataHora(c.criadoEm), texto: c.texto }))}
          />
          <p className="legenda leitura mt-24">
            Os números vêm da planilha da proposta e da convenção informadas. A Equapar aplica a estrutura de cálculo; a revisão por profissional habilitado é recomendada antes do protocolo.
          </p>
        </>
      )}
    </>
  );
}
