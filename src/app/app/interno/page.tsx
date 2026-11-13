import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { reais } from "@/lib/format";
import { medianaDiasMontagem, podeVerPainel, recuperadoNoPrazoPorMes, retencao } from "@/lib/metricas";
import { CabecalhoPagina } from "@/components/ui/estrutura";

export const metadata: Metadata = { title: "Painel interno | Equapar" };

const FUNIL = [
  ["raiox_consultado", "Raio-X consultado"],
  ["conta_criada", "Conta criada"],
  ["contratos_importados", "Carteira importada"],
  ["pedido_iniciado", "Pedido iniciado"],
  ["pedido_gerado", "Pedido gerado"],
] as const;

const mesIso = (d: Date) => d.toISOString().slice(0, 7);

/** Datas da consulta (fora do componente: a página é renderizada a cada pedido). */
function periodo() {
  const hoje = new Date();
  return { hoje, desde: new Date(hoje.getTime() - 90 * 86_400_000) };
}

/** Fase 1 (4.4): painel do dono. Só para os e-mails em PAINEL_EMAILS; para os demais, a página não existe. */
export default async function PainelInterno() {
  const ctx = await contexto();
  if (!podeVerPainel(ctx.usuario.email)) notFound();
  const { hoje, desde } = periodo();
  const contagens = await Promise.all(FUNIL.map(([nome]) => db.evento.count({ where: { nome, criadoEm: { gte: desde } } })));
  const pagantes = (await db.fatura.findMany({ where: { pagaEm: { gte: desde } }, distinct: ["contaId"], select: { contaId: true } })).length;
  const pedidos = await db.pedido.findMany({
    where: { contrato: { empresa: { exemplo: false, conta: { demo: false } } } },
    select: { valorDeferido: true, deferidoEm: true, protocoloData: true, criadoEm: true, geradoEm: true, contrato: { select: { vigenciaFim: true } } },
  });
  const recuperado = recuperadoNoPrazoPorMes(pedidos.map((p) => ({ ...p, fimVigencia: p.contrato.vigenciaFim })));
  const faturas = await db.fatura.findMany({ where: { pagaEm: { not: null } }, select: { contaId: true, referencia: true, valor: true } });
  const meses = Array.from({ length: 6 }, (_, i) => mesIso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 5 + i, 1))));
  const ret = meses.slice(1).map((m, i) => ({ mes: m, ...retencao(faturas, meses[i], m) }));
  const montagem = medianaDiasMontagem(pedidos);
  return (
    <>
      <CabecalhoPagina titulo="Painel interno" subtitulo="Só para o dono. Contagens e valores, sem dado pessoal. Funil dos últimos 90 dias." />
      <div className="grade-2">
        <section className="cartao">
          <h2>Funil (90 dias)</h2>
          <table className="tabela">
            <tbody>
              {FUNIL.map(([, rotulo], i) => (
                <tr key={rotulo}>
                  <td>{rotulo}</td>
                  <td className="num">{contagens[i]}</td>
                </tr>
              ))}
              <tr>
                <td>Contas que pagaram</td>
                <td className="num">{pagantes}</td>
              </tr>
            </tbody>
          </table>
          <p className="legenda mt-8 mb-0">Os eventos não levam a conta: incluem visitas da demonstração.</p>
        </section>
        <section className="cartao">
          <h2>Valor recuperado no prazo, por mês</h2>
          {recuperado.length ? (
            <table className="tabela">
              <tbody>
                {recuperado.map((r) => (
                  <tr key={r.mes}>
                    <td>{r.mes}</td>
                    <td className="num">{reais(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="secundario">Nenhum pedido deferido ainda (contas de exemplo e demonstração ficam de fora).</p>
          )}
          <p className="legenda mb-0">Diferenças deferidas de pedidos protocolados até o fim da vigência, pelo mês do deferimento.</p>
        </section>
        <section className="cartao">
          <h2>Retenção de receita</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Bruta</th>
                <th className="num">Líquida</th>
              </tr>
            </thead>
            <tbody>
              {ret.map((r) => (
                <tr key={r.mes}>
                  <td>{r.mes}</td>
                  <td className="num">{r.bruta == null ? "—" : `${r.bruta}%`}</td>
                  <td className="num">{r.liquida == null ? "—" : `${r.liquida}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="legenda mb-0">Sobre as faturas pagas. Fica completa quando a cobrança (4.2) estiver ligada.</p>
        </section>
        <section className="cartao">
          <h2>Tempo de montagem do pedido</h2>
          <p className="valor-n">{montagem == null ? "—" : `${String(montagem).replace(".", ",")} dias`}</p>
          <p className="legenda mb-0">Mediana entre iniciar o pedido e gerar os documentos.</p>
        </section>
      </div>
    </>
  );
}
