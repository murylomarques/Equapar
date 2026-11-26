import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { contexto } from "@/lib/auth";
import { hojeUTC, plural, reais } from "@/lib/format";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { pedidosParaRelatorio } from "@/lib/relatorios-pdf";
import { anosComMovimento, relatorioDoAno } from "@/lib/relatorios";

export const metadata: Metadata = { title: "Relatório do ano | Equapar" };

export default async function RelatorioAno({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const ctx = await contexto();
  const pedidos = await pedidosParaRelatorio(ctx);
  const anos = anosComMovimento(pedidos, hojeUTC());
  const pedido = Number((await searchParams).ano);
  const ano = anos.includes(pedido) ? pedido : hojeUTC().getUTCFullYear();
  const r = relatorioDoAno(pedidos, ano);
  const t = r.total;

  return (
    <>
      <CabecalhoPagina
        trilha={[{ rotulo: "A receber", href: "/app/a-receber" }, { rotulo: "Relatório do ano" }]}
        titulo={`Relatório de ${ano}`}
        subtitulo={`${plural(t.montados, "pedido montado", "pedidos montados")} · ${reais(t.recebido)} recebidos`}
        acao={
          <a href={`/api/relatorios/ano?ano=${ano}`} className="btn" download>
            Baixar PDF
          </a>
        }
      />
      {anos.length > 1 && (
        <nav aria-label="Ano" className="fileira mb-16">
          {anos.map((a) => (
            <Link key={a} href={`/app/a-receber/ano?ano=${a}`} className={a === ano ? "btn btn-pequeno btn-primario" : "btn btn-pequeno"} aria-current={a === ano ? "page" : undefined}>
              {a}
            </Link>
          ))}
        </nav>
      )}
      {r.linhas.length === 0 ? (
        <EstadoVazio icone={CalendarRange} titulo={`Nenhum movimento em ${ano}`} porque="O relatório mostra os pedidos montados, deferidos, faturados e recebidos no ano escolhido." />
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Contrato</th>
                <th scope="col" className="num">
                  Montados
                </th>
                <th scope="col" className="num">
                  Mensal pedido
                </th>
                <th scope="col" className="num">
                  Retroativo pedido
                </th>
                <th scope="col" className="num">
                  Mensal deferido
                </th>
                <th scope="col" className="num">
                  Retroativo deferido
                </th>
                <th scope="col" className="num">
                  Faturado
                </th>
                <th scope="col" className="num">
                  Recebido
                </th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((l) => (
                <tr key={l.contratoId}>
                  <td>
                    <Link href={`/app/contratos/${l.contratoId}`}>{l.numero}</Link>
                    <div className="legenda">{l.orgao}</div>
                  </td>
                  <td className="num">{l.montados}</td>
                  <td className="num">{reais(l.mensalPedido)}</td>
                  <td className="num">{reais(l.retroativoPedido)}</td>
                  <td className="num">{reais(l.mensalDeferido)}</td>
                  <td className="num">{reais(l.retroativoDeferido)}</td>
                  <td className="num">{reais(l.faturado)}</td>
                  <td className="num">{reais(l.recebido)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="num">{t.montados}</td>
                <td className="num">{reais(t.mensalPedido)}</td>
                <td className="num">{reais(t.retroativoPedido)}</td>
                <td className="num">{reais(t.mensalDeferido)}</td>
                <td className="num">{reais(t.retroativoDeferido)}</td>
                <td className="num">{reais(t.faturado)}</td>
                <td className="num">{reais(t.recebido)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="legenda leitura mt-16">
        Montados: pedidos gerados no ano, com a diferença mensal e o retroativo pedidos. Deferidos: respostas do órgão no ano (aumento mensal e retroativo aprovados). Faturado e recebido: notas e
        recebimentos registrados no ano; lançamentos cancelados não entram. Mensal e retroativo ficam separados e não se somam.
      </p>
    </>
  );
}
