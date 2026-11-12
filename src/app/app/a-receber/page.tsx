import type { Metadata } from "next";
import Link from "next/link";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { escopoPedidos } from "@/lib/consultas";
import { data, diasAte, diasAtras, reais, reaisResumo } from "@/lib/format";
import { SeloSimples } from "@/components/selo";

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
  const total = pedidos.reduce((s, p) => s + Number(p.valorDeferido ?? 0), 0);
  const recebido12 = recebidos.reduce((s, p) => s + Number(p.valorRecebido ?? 0), 0);

  return (
    <>
      <div className="app-cab">
        <div>
          <h1>A receber</h1>
          <p className="mt-16 mb-0" style={{ fontSize: 20, fontWeight: 600 }} title={reais(total)}>
            {reaisResumo(total)} deferidos e ainda não recebidos
          </p>
        </div>
      </div>
      {pedidos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nada a receber agora. Pedidos deferidos aparecem aqui até o dinheiro entrar.</p>
        </div>
      ) : (
        <>
          <div className="tabela-rolagem so-desktop">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Órgão</th>
                  <th scope="col">Deferido em</th>
                  <th scope="col">Apostilado</th>
                  <th scope="col">Faturado</th>
                  <th scope="col">Recebido</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const semApost = !p.apostiladoEm && p.deferidoEm && diasAte(p.deferidoEm) <= -30;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link className="linha-link" href={`/app/contratos/${p.contrato.id}`}>
                          {p.contrato.numero}
                        </Link>
                        {ctx.conta.tipo === "ASSESSORIA" && <div className="legenda">{p.contrato.empresa.razaoSocial}</div>}
                      </td>
                      <td>{p.contrato.orgao}</td>
                      <td>{data(p.deferidoEm)}</td>
                      <td>
                        {p.apostiladoEm ? (
                          <SeloSimples texto={data(p.apostiladoEm)} tom="verde" />
                        ) : (
                          <SeloSimples texto={semApost ? "Falta há +30 dias" : "Falta"} tom={semApost ? "carimbo" : "ambar"} icone="alerta" />
                        )}
                      </td>
                      <td>{p.faturadoEm ? <SeloSimples texto={`NF ${p.notaFiscal}`} tom="verde" /> : <SeloSimples texto="Falta" tom="ambar" icone="alerta" />}</td>
                      <td>
                        <SeloSimples texto="Ainda não" tom="neutro" icone="relogio" />
                      </td>
                      <td className="num">{reais(p.valorDeferido)}</td>
                      <td>
                        <Link href={`/app/pedidos/${p.id}/pronto`} className="btn btn-pequeno">
                          {p.estado === "FATURADO" ? "Marcar como recebido" : p.apostiladoEm ? "Gerar cobrança da diferença" : "Registrar apostilamento"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
                <div className="entre" style={{ marginTop: 6 }}>
                  <SeloSimples texto={p.estado === "FATURADO" ? "Faturado" : p.apostiladoEm ? "Apostilado" : "Falta apostilar"} tom={p.apostiladoEm ? "verde" : "ambar"} />
                  <span className="num">{reais(p.valorDeferido)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {recebidos.length > 0 && (
        <section className="mt-24">
          <h2>Recebido nos últimos 12 meses: {reaisResumo(recebido12)}</h2>
          <ul className="lista-limpa pilha-8">
            {recebidos.map((p) => (
              <li key={p.id} className="entre cartao-linha">
                <span>
                  Contrato {p.contrato.numero} · {p.contrato.orgao} · recebido em {data(p.recebidoEm)}
                </span>
                <span className="num">{reais(p.valorRecebido)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
