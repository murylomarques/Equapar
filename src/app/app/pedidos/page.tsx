import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, SearchX } from "lucide-react";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { escopoPedidos } from "@/lib/consultas";
import { ESTADOS, NOME_ESTADO } from "@/lib/pedido";
import { dataLocal, reais } from "@/lib/format";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { SeloSimples } from "@/components/selo";
import type { Tom } from "@/lib/prazos";

export const metadata: Metadata = { title: "Pedidos | Equapar" };

const TOM: Record<string, Tom> = {
  EM_ANALISE: "ambar",
  CALCULO_VALIDADO: "ambar",
  PROTOCOLADO: "azul",
  DEFERIDO: "verde",
  FATURADO: "verde",
  RECEBIDO: "neutro",
  INDEFERIDO: "carimbo",
};

/** Um ícone por situação, igual na tabela e nos cartões do celular. */
const ICONE: Record<string, "relogio" | "check" | "ampulheta" | "carimbo" | "cifrao" | "alerta"> = {
  EM_ANALISE: "relogio",
  CALCULO_VALIDADO: "check",
  PROTOCOLADO: "ampulheta",
  DEFERIDO: "carimbo",
  FATURADO: "cifrao",
  RECEBIDO: "check",
  INDEFERIDO: "alerta",
};

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const ctx = await contexto();
  const { estado } = await searchParams;
  const base = escopoPedidos(ctx);
  const contagem = await db.pedido.groupBy({ by: ["estado"], where: base, _count: true });
  const n = (e: string) => contagem.find((c) => c.estado === e)?._count ?? 0;
  const total = contagem.reduce((s, c) => s + c._count, 0);
  const pedidos = await db.pedido.findMany({
    where: { ...base, ...(estado ? { estado: estado as never } : {}) },
    include: { contrato: { include: { empresa: true } } },
    orderBy: { atualizadoEm: "desc" },
  });
  const href = (p: { id: string; estado: string }) => (p.estado === "EM_ANALISE" ? `/app/pedidos/${p.id}` : `/app/pedidos/${p.id}/pronto`);
  return (
    <>
      <CabecalhoPagina
        titulo="Pedidos"
        subtitulo="Cada pedido segue do cálculo até o dinheiro entrar."
        acao={
          <Link href="/app/carteira" className="btn">
            Novo pedido pela carteira
          </Link>
        }
      />
      <nav className="filtros" aria-label="Situação do pedido">
        <Link href="/app/pedidos" className="filtro" aria-current={!estado ? "true" : undefined}>
          Todos <span className="n">({total})</span>
        </Link>
        {[...ESTADOS, { id: "INDEFERIDO", nome: "Indeferido" }]
          .filter((e) => n(e.id) > 0 || estado === e.id)
          .map((e) => (
            <Link key={e.id} href={`/app/pedidos?estado=${e.id}`} className="filtro" aria-current={estado === e.id ? "true" : undefined}>
              {e.nome} <span className="n">({n(e.id)})</span>
            </Link>
          ))}
      </nav>
      {pedidos.length === 0 ? (
        total === 0 ? (
          <EstadoVazio
            icone={FileText}
            titulo="Nenhum pedido ainda"
            porque="Os pedidos de repactuação começam pela carteira ou pela tela Hoje, quando há uma convenção nova."
            acao={
              <Link href="/app/carteira" className="btn btn-primario">
                Ir para a carteira
              </Link>
            }
          />
        ) : (
          <EstadoVazio
            icone={SearchX}
            titulo="Nenhum pedido nesta situação"
            acao={
              <Link href="/app/pedidos" className="btn">
                Ver todos
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="tabela-rolagem so-desktop">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Órgão</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="num">
                    Diferença por mês
                  </th>
                  <th scope="col" className="num">
                    Desde a data-base
                  </th>
                  <th scope="col" className="num col-ampla">
                    Atualizado
                  </th>
                  <th scope="col" className="col-seta">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="linha-clicavel">
                    <td>
                      <Link className="linha-link" href={href(p)}>
                        {p.contrato.numero}
                      </Link>
                      {ctx.conta.tipo === "ASSESSORIA" && <div className="legenda">{p.contrato.empresa.razaoSocial}</div>}
                    </td>
                    <td>{p.contrato.orgao}</td>
                    <td>
                      <SeloSimples texto={NOME_ESTADO[p.estado]} tom={TOM[p.estado]} icone={ICONE[p.estado]} />
                      {p.estado === "EM_ANALISE" && <div className="legenda mt-8">passo {p.passoAtual} de 5</div>}
                    </td>
                    <td className="num">{p.diferencaMensal ? reais(p.diferencaMensal) : "—"}</td>
                    <td className="num">{p.diferencaRetroativa ? reais(p.diferencaRetroativa) : "—"}</td>
                    <td className="num col-ampla">{dataLocal(p.atualizadoEm)}</td>
                    <td className="col-seta">
                      <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="cartao-contrato-seta" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cartoes-celular">
            {pedidos.map((p) => (
              <Link key={p.id} href={href(p)} className="cartao-linha cartao-contrato">
                <div className="cartao-contrato-corpo">
                <strong>
                  Contrato {p.contrato.numero} · {p.contrato.orgao}
                </strong>
                {ctx.conta.tipo === "ASSESSORIA" && <span className="legenda">{p.contrato.empresa.razaoSocial}</span>}
                <div className="pedido-cartao-situacao">
                  <SeloSimples texto={NOME_ESTADO[p.estado]} tom={TOM[p.estado]} icone={ICONE[p.estado]} />
                  {p.estado === "EM_ANALISE" && <span className="legenda">passo {p.passoAtual} de 5</span>}
                </div>
                <dl className="pedido-cartao-valores">
                  <div>
                    <dt>Diferença/mês</dt>
                    <dd className="num">{p.diferencaMensal ? reais(p.diferencaMensal) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Desde a data-base</dt>
                    <dd className="num">{p.diferencaRetroativa ? reais(p.diferencaRetroativa) : "—"}</dd>
                  </div>
                </dl>
                </div>
                <ChevronRight size={20} strokeWidth={1.5} aria-hidden className="cartao-contrato-seta" />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
