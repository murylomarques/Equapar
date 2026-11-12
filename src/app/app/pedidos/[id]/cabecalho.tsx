import Link from "next/link";
import { PASSOS } from "@/lib/pedido";
import { hora } from "@/lib/format";

export function CabecalhoPedido({
  pedido,
  passo,
}: {
  pedido: { id: string; passoAtual: number; atualizadoEm: Date; contrato: { id: string; numero: string; orgao: string } };
  passo: number;
}) {
  return (
    <>
      <div className="app-cab" style={{ marginBottom: 16 }}>
        <div>
          <p className="legenda mb-0">
            <Link href={`/app/contratos/${pedido.contrato.id}`}>
              Contrato {pedido.contrato.numero} · {pedido.contrato.orgao}
            </Link>
          </p>
          <h1>Pedido de repactuação</h1>
        </div>
        <span className="salvo">Salvo às {hora(pedido.atualizadoEm)}</span>
      </div>
      <ol className="progresso" aria-label="Passos do pedido">
        {PASSOS.map((p, i) => {
          const n = i + 1;
          const cls = n < passo ? "feito" : n === passo ? "atual" : undefined;
          return (
            <li key={p} className={cls} aria-current={n === passo ? "step" : undefined}>
              {n <= pedido.passoAtual && n !== passo ? (
                <Link href={`/app/pedidos/${pedido.id}/passo/${n}`}>
                  {n} {p}
                </Link>
              ) : (
                `${n} ${p}`
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
