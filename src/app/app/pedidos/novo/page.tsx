import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contexto, pode } from "@/lib/auth";
import { SemPermissao } from "@/components/sem-permissao";
import { db } from "@/lib/db";
import { data, MESES } from "@/lib/format";
import { PASSOS } from "@/lib/pedido";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { Alerta, CabecalhoPagina } from "@/components/ui/estrutura";
import { iniciarPedido } from "../acoes";

export const metadata: Metadata = { title: "Novo pedido | Equapar" };

const DESCRICAO_PASSO = [
  "O que motiva o pedido e a data-base.",
  "Os custos de hoje, como estão no contrato.",
  "Os valores novos, com a fonte de cada um.",
  "Convenção, planilha e comprovantes anexados.",
  "Conferir tudo e gerar o pedido.",
];

export default async function NovoPedido({ searchParams }: { searchParams: Promise<{ contrato?: string }> }) {
  const ctx = await contexto();
  if (!pode(ctx.papel, "editar_pedidos")) return <SemPermissao acao="montar pedidos" />;
  const { contrato } = await searchParams;
  if (!contrato) redirect("/app/carteira");
  const c = await db.contrato.findFirst({ where: { id: contrato, empresa: { contaId: ctx.conta.id } }, include: { convencao: true } });
  if (!c) notFound();
  const aberto = await db.pedido.findFirst({ where: { contratoId: c.id, estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } });
  if (aberto) redirect(`/app/pedidos/${aberto.id}`);
  return (
    <>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Carteira", href: "/app/carteira" },
          { rotulo: `Contrato ${c.numero}`, href: `/app/contratos/${c.id}` },
          { rotulo: "Novo pedido" },
        ]}
        titulo="Pedido de repactuação"
        subtitulo={`Contrato ${c.numero} · ${c.orgao}`}
      />
      <div className="novo-pedido">
        <section className="cartao" aria-labelledby="novo-pedido-passos">
          <h2 id="novo-pedido-passos">Como funciona</h2>
          <p className="secundario">O assistente tem cinco passos. Tudo é salvo enquanto você preenche, e dá para parar e continuar depois.</p>
          <ol className="novo-pedido-passos">
            {PASSOS.map((p, i) => (
              <li key={p}>
                <span className="novo-pedido-n" aria-hidden>
                  {i + 1}
                </span>
                <span>
                  <strong>{p}</strong>
                  <span className="legenda">{DESCRICAO_PASSO[i]}</span>
                </span>
              </li>
            ))}
          </ol>
          {c.tipoReajuste === "INDICE" && (
            <Alerta tipo="atencao" className="mt-16">
              Este contrato está marcado como reajuste por índice. A conta completa da Equapar é para repactuação de contratos com mão de obra.
            </Alerta>
          )}
          <FormAcao action={iniciarPedido} semToast className="mt-24">
            <input type="hidden" name="contratoId" value={c.id} />
            <div className="fileira">
              <BotaoEnvio>Começar</BotaoEnvio>
              <Link href={`/app/contratos/${c.id}`} className="btn btn-discreto">
                Voltar ao contrato
              </Link>
            </div>
          </FormAcao>
        </section>
        <aside className="cartao" aria-labelledby="novo-pedido-contrato">
          <h2 id="novo-pedido-contrato">Contrato</h2>
          <dl className="dl-resumo">
            <dt>Número</dt>
            <dd>{c.numero}</dd>
            <dt>Órgão</dt>
            <dd>{c.orgao}</dd>
            <dt>Fim da vigência</dt>
            <dd>{data(c.vigenciaFim)}</dd>
            <dt>Convenção</dt>
            <dd>{c.convencao ? `${c.convencao.nome}, data-base em ${MESES[c.convencao.mesDataBase - 1]}` : "Não informada (você escolhe no passo 1)"}</dd>
          </dl>
          <hr className="regua" />
          <h3>Tenha à mão</h3>
          <ul className="pilha-8 legenda" style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>A planilha de custos vigente do contrato.</li>
            <li>A convenção coletiva nova (PDF), se o gatilho for convenção.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
