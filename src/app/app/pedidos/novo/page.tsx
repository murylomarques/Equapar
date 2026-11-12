import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contexto, pode } from "@/lib/auth";
import { SemPermissao } from "@/components/sem-permissao";
import { db } from "@/lib/db";
import { data, MESES } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { iniciarPedido } from "../acoes";

export const metadata: Metadata = { title: "Novo pedido | Equapar" };

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
    <div className="cartao" style={{ maxWidth: 680 }}>
      <h1>Pedido de repactuação</h1>
      <p>
        <strong>
          Contrato {c.numero} · {c.orgao}
        </strong>
        <br />
        <span className="secundario">
          Termina em {data(c.vigenciaFim)}
          {c.convencao ? ` · ${c.convencao.nome}, data-base ${MESES[c.convencao.mesDataBase - 1]}` : " · convenção não informada"}
        </span>
      </p>
      <p className="secundario">O assistente tem cinco passos: gatilho, planilha atual, novos custos, documentos e revisão. Tudo é salvo enquanto você preenche.</p>
      {c.tipoReajuste === "INDICE" && (
        <p className="aviso-caixa">Este contrato está marcado como reajuste por índice. A conta completa da Equapar é para repactuação de contratos com mão de obra.</p>
      )}
      <FormAcao action={iniciarPedido}>
        <input type="hidden" name="contratoId" value={c.id} />
        <div className="fileira">
          <BotaoEnvio>Começar</BotaoEnvio>
          <Link href={`/app/contratos/${c.id}`} className="btn">
            Voltar
          </Link>
        </div>
      </FormAcao>
    </div>
  );
}
