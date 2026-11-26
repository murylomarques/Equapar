import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { escopoPedidos } from "@/lib/consultas";
import { data, diasAte, diasAtras, plural, reais, reaisResumo, somarReais } from "@/lib/format";
import { SeloSimples } from "@/components/selo";
import { Alerta, CabecalhoPagina, Termo } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { modoPiloto } from "@/lib/chaves";
import { resumoFinanceiro } from "@/lib/financeiro-pedido";

export const metadata: Metadata = { title: "A receber | Equapar" };

export default async function AReceber() {
  const ctx = await contexto();
  const pedidosDb = await db.pedido.findMany({
    where: { ...escopoPedidos(ctx), estado: { in: ["DEFERIDO", "FATURADO"] } },
    include: { contrato: { include: { empresa: true } }, notasFiscais: true, baixas: true },
    orderBy: { deferidoEm: "asc" },
  });
  const pedidos = pedidosDb.map((p) => ({ ...p, financeiro: resumoFinanceiro(p.retroativoAprovado ?? p.valorDeferido ?? 0, p.notasFiscais, p.baixas) }));
  const recebidos = await db.pedido.findMany({
    where: { ...escopoPedidos(ctx), estado: "RECEBIDO", recebidoEm: { gte: diasAtras(365) } },
    include: { contrato: true },
    orderBy: { recebidoEm: "desc" },
  });
  const total = somarReais(pedidos.map((p) => p.financeiro.totalPendente));
  const recebido12 = somarReais(recebidos.map((p) => p.valorRecebido));
  const atrasados = pedidos.filter((p) => !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm) <= -30);
  const acao = (p: (typeof pedidos)[number]) => (p.estado === "FATURADO" ? "Registrar recebimento" : p.apostiladoEm ? "Registrar nota fiscal" : "Registrar apostilamento");

  return (
    <>
      <CabecalhoPagina
        titulo="A receber"
        subtitulo={pedidos.length ? `${reaisResumo(total)} de saldo aprovado ainda não recebido` : undefined}
        acao={
          <div className="fileira">
            <Link href="/app/a-receber/ano" className="btn">
              Relatório do ano
            </Link>
            {!modoPiloto() && (
              <Link href="/app/recuperado" className="btn">
                Recuperado com a Equapar
              </Link>
            )}
          </div>
        }
      />
      {atrasados.length > 0 && (
        <Alerta tipo="atencao" className="mb-16" titulo={`${plural(atrasados.length, "pedido deferido", "pedidos deferidos")} há mais de 30 dias sem apostilamento`}>
          Sem <Termo>apostilamento</Termo>, o órgão não paga a diferença. Vale cobrar o fiscal do contrato: {atrasados.map((p) => `contrato ${p.contrato.numero}`).join(", ")}.
        </Alerta>
      )}
      {pedidos.length === 0 ? (
        <EstadoVazio
          icone={DollarSign}
          titulo="Nada a receber agora"
          porque="Quando um pedido é deferido, ele aparece aqui e só sai quando o dinheiro entra no caixa."
          acao={
            <Link href="/app/pedidos" className="btn">
              Ver pedidos
            </Link>
          }
        />
      ) : (
        <>
          <div className="tabela-rolagem so-largo">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Órgão</th>
                  <th scope="col">Deferido</th>
                  <th scope="col">Apostilado</th>
                  <th scope="col">Faturado</th>
                  <th scope="col">Recebido</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">
                    <span className="sr-only">Próximo passo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const semApost = !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm) <= -30;
                  return (
                    <tr key={p.id} className="linha-clicavel">
                      <td>
                        <Link className="linha-link" href={`/app/pedidos/${p.id}/pronto`}>
                          {p.contrato.numero}
                        </Link>
                        {ctx.conta.tipo === "ASSESSORIA" && <div className="legenda">{p.contrato.empresa.razaoSocial}</div>}
                      </td>
                      <td>{p.contrato.orgao}</td>
                      <td>
                        <SeloSimples texto={data(p.deferidoEm)} tom="verde" icone="carimbo" />
                      </td>
                      <td>
                        {p.apostiladoEm ? (
                          <SeloSimples texto={data(p.apostiladoEm)} tom="verde" icone="check" />
                        ) : (
                          <SeloSimples texto={semApost ? "Falta há mais de 30 dias" : "Falta"} tom={semApost ? "carimbo" : "ambar"} icone="alerta" />
                        )}
                      </td>
                      <td>{Number(p.financeiro.faturado) > 0 ? <SeloSimples texto={reais(p.financeiro.faturado)} tom="verde" icone="check" /> : <SeloSimples texto="Falta" tom="neutro" icone="relogio" />}</td>
                      <td>
                        <SeloSimples texto={Number(p.financeiro.recebido) > 0 ? reais(p.financeiro.recebido) : "Ainda não"} tom={Number(p.financeiro.recebido) > 0 ? "verde" : "neutro"} icone={Number(p.financeiro.recebido) > 0 ? "check" : "relogio"} />
                      </td>
                      <td className="num">{reais(p.financeiro.totalPendente)}</td>
                      <td>
                        <Link href={`/app/pedidos/${p.id}/pronto`} className="btn btn-pequeno acima">
                          {acao(p)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                <tr className="total">
                  <td colSpan={6}>Total a receber</td>
                  <td className="num">{reais(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="cartoes-estreito">
            {pedidos.map((p) => (
              <div key={p.id} className="cartao-linha cartao-com-acao">
                <Link href={`/app/pedidos/${p.id}/pronto`} className="cartao-linha-link">
                  <strong>{p.contrato.orgao}</strong>
                  <span className="legenda">
                    Contrato {p.contrato.numero} · deferido em {data(p.deferidoEm)}
                  </span>
                </Link>
                <div className="entre mt-8">
                  <SeloSimples texto={p.estado === "FATURADO" ? "Faturado" : p.apostiladoEm ? "Apostilado" : "Falta apostilar"} tom={p.apostiladoEm ? "verde" : "ambar"} icone={p.estado === "FATURADO" ? "cifrao" : p.apostiladoEm ? "check" : "alerta"} />
                  <span className="num">{reais(p.financeiro.totalPendente)}</span>
                </div>
                <Link href={`/app/pedidos/${p.id}/pronto`} className="btn btn-largura-total mt-16">
                  {acao(p)}
                </Link>
              </div>
            ))}
            {pedidos.length > 1 && (
              <div className="cartao-linha entre" style={{ fontWeight: 600 }}>
                <span>Total a receber</span>
                <span className="num">{reais(total)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {recebidos.length > 0 && (
        <section className="mt-32">
          <h2>Recebido nos últimos 12 meses: {reaisResumo(recebido12)}</h2>
          <ul className="lista-limpa pilha-8">
            {recebidos.map((p) => (
              <li key={p.id}>
                <Link href={`/app/pedidos/${p.id}/pronto`} className="cartao-linha entre">
                  <span>
                    Contrato {p.contrato.numero} · {p.contrato.orgao} · recebido em {data(p.recebidoEm)}
                  </span>
                  <span className="num">{reais(p.valorRecebido)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
