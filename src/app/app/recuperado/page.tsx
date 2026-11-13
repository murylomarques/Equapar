import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { escopoPedidos } from "@/lib/consultas";
import { reais } from "@/lib/format";
import { resumoRecuperado } from "@/lib/recuperado";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { BotaoImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Recuperado com a Equapar | Equapar" };

/** 5.2: total deferido e recebido, por ano e por contrato. Para o dono e para a renovação. */
export default async function Recuperado() {
  const ctx = await contexto();
  const pedidos = await db.pedido.findMany({
    where: { ...escopoPedidos(ctx), OR: [{ deferidoEm: { not: null } }, { recebidoEm: { not: null } }] },
    select: { contratoId: true, deferidoEm: true, valorDeferido: true, recebidoEm: true, valorRecebido: true, contrato: { select: { numero: true, orgao: true } } },
  });
  const r = resumoRecuperado(pedidos);
  return (
    <>
      <CabecalhoPagina
        trilha={[{ rotulo: "A receber", href: "/app/a-receber" }, { rotulo: "Recuperado com a Equapar" }]}
        titulo="Recuperado com a Equapar"
        subtitulo="Valores deferidos e recebidos registrados nos pedidos da conta. Nada aqui é estimativa."
        acao={r.porAno.length ? <BotaoImprimir /> : undefined}
      />
      {r.porAno.length === 0 ? (
        <EstadoVazio
          icone={DollarSign}
          titulo="Nenhum valor deferido ainda"
          porque="Quando um pedido for deferido e o dinheiro entrar, os totais aparecem aqui, por ano e por contrato."
          acao={
            <Link href="/app/pedidos" className="btn">
              Ver pedidos
            </Link>
          }
        />
      ) : (
        <div className="pilha" style={{ gap: 24 }}>
          <div className="memoria-topo">
            <div>
              <span className="legenda">Total deferido</span>
              <strong className="tnum">{reais(r.totalDeferido)}</strong>
            </div>
            <div>
              <span className="legenda">Total recebido</span>
              <strong className="tnum">{reais(r.totalRecebido)}</strong>
            </div>
          </div>
          <section className="cartao">
            <h2>Por ano</h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col" className="num">
                    Deferido
                  </th>
                  <th scope="col" className="num">
                    Recebido
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.porAno.map((a) => (
                  <tr key={a.ano}>
                    <td className="tnum">{a.ano}</td>
                    <td className="num">{reais(a.deferido)}</td>
                    <td className="num">{reais(a.recebido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="cartao">
            <h2>Por contrato</h2>
            <div className="tabela-rolagem" style={{ border: 0, boxShadow: "none" }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Contrato</th>
                    <th scope="col" className="num">
                      Deferido
                    </th>
                    <th scope="col" className="num">
                      Recebido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.porContrato.map((c) => (
                    <tr key={c.contratoId}>
                      <td>
                        <Link href={`/app/contratos/${c.contratoId}`}>Contrato {c.numero}</Link>
                        <div className="legenda">{c.orgao}</div>
                      </td>
                      <td className="num">{reais(c.deferido)}</td>
                      <td className="num">{reais(c.recebido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
