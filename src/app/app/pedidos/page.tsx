import type { Metadata } from "next";
import Link from "next/link";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { escopoPedidos } from "@/lib/consultas";
import { ESTADOS, NOME_ESTADO } from "@/lib/pedido";
import { reais, dataLocal } from "@/lib/format";

export const metadata: Metadata = { title: "Pedidos | Equapar" };

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const ctx = await contexto();
  const { estado } = await searchParams;
  const base = escopoPedidos(ctx);
  const contagem = await db.pedido.groupBy({ by: ["estado"], where: base, _count: true });
  const n = (e: string) => contagem.find((c) => c.estado === e)?._count ?? 0;
  const pedidos = await db.pedido.findMany({
    where: { ...base, ...(estado ? { estado: estado as never } : {}) },
    include: { contrato: { include: { empresa: true } } },
    orderBy: { atualizadoEm: "desc" },
  });
  return (
    <>
      <div className="app-cab">
        <h1>Pedidos</h1>
        <Link href="/app/carteira" className="btn">
          Escolher contrato para novo pedido
        </Link>
      </div>
      <nav className="filtros" aria-label="Estados do pedido">
        <Link href="/app/pedidos" className="filtro" aria-current={!estado ? "true" : undefined}>
          Todos
        </Link>
        {[...ESTADOS, { id: "INDEFERIDO", nome: "Indeferido" }].map((e) => (
          <Link key={e.id} href={`/app/pedidos?estado=${e.id}`} className="filtro" aria-current={estado === e.id ? "true" : undefined}>
            {e.nome} ({n(e.id)})
          </Link>
        ))}
      </nav>
      {pedidos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum pedido{estado ? " nesta situação" : " ainda"}. Os pedidos começam na carteira ou na tela Hoje.</p>
        </div>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Órgão</th>
                <th>Situação</th>
                <th className="num">Diferença por mês</th>
                <th className="num">Desde a data-base</th>
                <th className="num">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="linha-link" href={p.estado === "EM_ANALISE" ? `/app/pedidos/${p.id}` : `/app/pedidos/${p.id}/pronto`}>
                      {p.contrato.numero}
                    </Link>
                    {ctx.conta.tipo === "ASSESSORIA" && <div className="legenda">{p.contrato.empresa.razaoSocial}</div>}
                  </td>
                  <td>{p.contrato.orgao}</td>
                  <td>
                    {NOME_ESTADO[p.estado]}
                    {p.estado === "EM_ANALISE" && <div className="legenda">passo {p.passoAtual} de 5</div>}
                  </td>
                  <td className="num">{p.diferencaMensal ? reais(p.diferencaMensal) : "—"}</td>
                  <td className="num">{p.diferencaRetroativa ? reais(p.diferencaRetroativa) : "—"}</td>
                  <td className="num">{dataLocal(p.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
