import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/auth";
import { pedidoExemplo } from "@/lib/demo";
import { brl, pct } from "@/lib/calculo/motor";
import { calcularPedido, NOME_GATILHO } from "@/lib/pedido";
import { data } from "@/lib/format";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { MemoriaView } from "../pedidos/[id]/memoria/memoria-view";

export const metadata: Metadata = { title: "Pedido pronto de exemplo | Equapar" };

/** 5.4: o pedido pronto de exemplo (dados fictícios), aberto em outra aba a partir das dicas do primeiro pedido. */
export default async function PedidoExemplo() {
  await contexto();
  const p = await pedidoExemplo();
  if (!p) notFound();
  const calc = calcularPedido(p);
  const comp = calc.comparacao;
  if (!comp) notFound();
  return (
    <>
      <CabecalhoPagina
        titulo="Pedido pronto de exemplo"
        selo={<span className="selo selo-ambar">Exemplo · dados fictícios</span>}
        subtitulo={`Contrato ${p.contrato.numero} · ${p.contrato.orgao} · ${NOME_GATILHO[p.gatilho]}${p.convencao ? ` · ${p.convencao.nome}` : ""} · data-base ${data(p.dataBase)}`}
      />
      <div className="cartao mb-16">
        <h2>O que foi entregue ao órgão</h2>
        <ul className="pilha-8" style={{ paddingLeft: 20, marginBottom: 0 }}>
          <li>Ofício com o pedido: novo valor mensal, data dos efeitos e pagamento das diferenças.</li>
          <li>Planilha de custos nova, no modelo da IN 05/2017, com a fonte de cada número alterado.</li>
          <li>Memória de cálculo linha a linha (abaixo), com a diferença por mês e a acumulada.</li>
          <li>Convenção coletiva nova e planilha da proposta como anexos.</li>
        </ul>
      </div>
      <div className="memoria-topo">
        <div>
          <span className="legenda">Diferença por mês</span>
          <strong className="tnum">{brl(comp.diferencaMensal)}</strong>
          <span className="legenda">
            {brl(comp.mensalAntes)} → {brl(comp.mensalAgora)} {comp.variacaoPct && `(+${pct(comp.variacaoPct)})`}
          </span>
        </div>
        <div>
          <span className="legenda">Desde a data-base</span>
          <strong className="tnum">{calc.retroativo ? brl(calc.retroativo.total) : "—"}</strong>
          <span className="legenda">até {data(calc.dataReferencia)}</span>
        </div>
      </div>
      <MemoriaView pedidoId={p.id} comp={comp} retro={calc.retroativo} comentarios={[]} podeComentar={false} linkConvencao={null} />
    </>
  );
}
