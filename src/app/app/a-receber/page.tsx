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

export const metadata: Metadata = { title: "A receber | Equapar" };

export default async function AReceber() {
  const ctx = await contexto();
  const pedidos = await db.pedido.findMany({
    where: { ...escopoPedidos(ctx), estado: { in: ["DEFERIDO", "FATURADO"] } },
    include: { contrato: { include: { empresa: true } } },
    orderBy: { deferidoEm: "asc" },
  });
  const recebidos = await db.pedido.findMany({
    where: { ...escopoPedidos(ctx), estado: "RECEBIDO", recebidoEm: { gte: diasAtras(365) } },
    include: { contrato: true },
    orderBy: { recebidoEm: "desc" },
  });
  const total = somarReais(pedidos.map((p) => p.valorDeferido)); // L10
  const recebido12 = somarReais(recebidos.map((p) => p.valorRecebido));
  const atrasados = pedidos.filter((p) => !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm) <= -30);
  const acao = (p: (typeof pedidos)[number]) => (p.estado === "FATURADO" ? "Marcar como recebido" : p.apostiladoEm ? "Gerar cobrança da diferença" : "Registrar apostilamento");

  return (
    <>
      <CabecalhoPagina
        titulo="A receber"
        subtitulo={pedidos.length ? `${reaisResumo(total)} deferidos e ainda não recebidos` : undefined}
        acao={
          <Link href="/app/recuperado" className="btn">
            Recuperado com a Equapar
          </Link>
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
          <div className="tabela-rolagem so-desktop">
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
                      <td>{p.faturadoEm ? <SeloSimples texto={`NF ${p.notaFiscal}`} tom="verde" icone="check" /> : <SeloSimples texto="Falta" tom="neutro" icone="relogio" />}</td>
                      <td>
                        <SeloSimples texto="Ainda não" tom="neutro" icone="relogio" />
                      </td>
                      <td className="num">{reais(p.valorDeferido)}</td>
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
          <div className="cartoes-celular">
            {pedidos.map((p) => (
              <Link key={p.id} href={`/app/pedidos/${p.id}/pronto`} className="cartao-linha">
                <strong>{p.contrato.orgao}</strong>
                <span className="legenda">
                  Contrato {p.contrato.numero} · deferido em {data(p.deferidoEm)}
                </span>
                <div className="entre mt-8">
                  <SeloSimples texto={p.estado === "FATURADO" ? "Faturado" : p.apostiladoEm ? "Apostilado" : "Falta apostilar"} tom={p.apostiladoEm ? "verde" : "ambar"} />
                  <span className="num">{reais(p.valorDeferido)}</span>
                </div>
                <span className="legenda" style={{ display: "block", marginTop: 6 }}>
                  Próximo passo: {acao(p).toLowerCase()}
                </span>
              </Link>
            ))}
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
