import { CabecalhoPagina, Passos } from "@/components/ui/estrutura";
import { PASSOS } from "@/lib/pedido";
import { hora } from "@/lib/format";
import { ItemDescartar } from "./descartar";

export function CabecalhoPedido({
  pedido,
  passo,
  podeEditar,
}: {
  pedido: { id: string; passoAtual: number; atualizadoEm: Date; contrato: { id: string; numero: string; orgao: string } };
  passo: number;
  podeEditar?: boolean;
}) {
  return (
    <div className="contexto-pedido">
      <CabecalhoPagina
        trilha={[
          { rotulo: "Pedidos", href: "/app/pedidos" },
          { rotulo: `Contrato ${pedido.contrato.numero}`, href: `/app/contratos/${pedido.contrato.id}` },
          { rotulo: "Pedido de repactuação" },
        ]}
        titulo="Pedido de repactuação"
        subtitulo={`Contrato ${pedido.contrato.numero} · ${pedido.contrato.orgao} · salvo às ${hora(pedido.atualizadoEm)}`}
        menu={podeEditar ? <ItemDescartar id={pedido.id} /> : undefined}
      />
      <Passos passos={PASSOS} atual={passo} liberados={pedido.passoAtual} hrefPasso={(n) => `/app/pedidos/${pedido.id}/passo/${n}`} />
    </div>
  );
}
