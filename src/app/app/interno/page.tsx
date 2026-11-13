import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { hojeUTC, paraInputData, reais, somarReais } from "@/lib/format";
import {
  custoPorAquisicao,
  margemEmReais,
  medianaDiasMontagem,
  novasPagantes,
  podeVerPainel,
  recuperadoNoPrazoPorMes,
  resultadoSeanEllis,
  retencao,
  RESPOSTAS_PESQUISA,
  tempoPorPlano,
  TIPOS_TEMPO,
} from "@/lib/metricas";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CampoData, CampoSelect, CampoTexto } from "@/components/ui/campos";
import { registrarTempo, salvarMetricaMensal } from "./acoes";

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
  const faturas = await db.fatura.findMany({ where: { pagaEm: { not: null } }, select: { contaId: true, referencia: true, valor: true, pagaEm: true } });
  const meses = Array.from({ length: 6 }, (_, i) => mesIso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 5 + i, 1))));
  const ret = meses.slice(1).map((m, i) => ({ mes: m, ...retencao(faturas, meses[i], m) }));
  const montagem = medianaDiasMontagem(pedidos);
  // 5.4: custo de aquisição e margem (números do dono); 5.5: tempo humano por plano e pesquisa de Sean Ellis
  const metricas = new Map((await db.metricaMensal.findMany({ where: { mes: { in: meses } } })).map((m) => [m.mes, m]));
  const negocio = meses.map((m) => {
    const x = metricas.get(m);
    const receita = somarReais(faturas.filter((f) => f.pagaEm && mesIso(f.pagaEm) === m).map((f) => f.valor));
    const novas = novasPagantes(faturas, m);
    return { mes: m, x, novas, cac: custoPorAquisicao(x?.custoAquisicao?.toString() ?? null, novas), margem: margemEmReais(receita.toString(), x?.margemPct?.toString() ?? null) };
  });
  const mesAtual = meses[meses.length - 1];
  const contas = await db.conta.findMany({ where: { demo: false, empresas: { some: { exemplo: false } } }, select: { id: true, nome: true, plano: true }, orderBy: { nome: "asc" } });
  const registros = await db.registroTempo.findMany({
    where: { data: { gte: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 5, 1)) } },
    select: { contaId: true, tipo: true, minutos: true, data: true },
  });
  const planoDe = new Map(contas.map((c) => [c.id, c.plano as string]));
  const tempo = tempoPorPlano(registros, planoDe, mesAtual);
  const ellis = resultadoSeanEllis(await db.respostaPesquisa.findMany({ select: { resposta: true } }));
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
          <h2>Custo de aquisição e margem</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Novas pagantes</th>
                <th className="num">Custo por conta nova</th>
                <th className="num">Margem bruta</th>
              </tr>
            </thead>
            <tbody>
              {negocio.map((n) => (
                <tr key={n.mes}>
                  <td>{n.mes}</td>
                  <td className="num">{n.novas}</td>
                  <td className="num">{n.cac == null ? "—" : reais(n.cac)}</td>
                  <td className="num">{n.margem == null ? "—" : `${reais(n.margem)} (${n.x!.margemPct!.toString().replace(".", ",")}%)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="legenda">Os indicadores aparecem quando o custo de aquisição e a margem do mês estão preenchidos.</p>
          <FormAcao action={salvarMetricaMensal} className="pilha-8">
            <div className="linha-form">
              <CampoSelect nome="mes" rotulo="Mês" valorInicial={mesAtual} opcoes={[...meses].reverse().map((m) => ({ valor: m, rotulo: m }))} />
              <CampoTexto nome="custoAquisicao" rotulo="Custo de aquisição no mês (R$)" opcional inputMode="decimal" valorInicial={metricas.get(mesAtual)?.custoAquisicao?.toString() ?? ""} />
              <CampoTexto nome="margemPct" rotulo="Margem bruta (%)" opcional inputMode="decimal" valorInicial={metricas.get(mesAtual)?.margemPct?.toString() ?? ""} />
            </div>
            <BotaoEnvio className="btn">Salvar números do mês</BotaoEnvio>
          </FormAcao>
        </section>
        <section className="cartao">
          <h2>Trabalho humano por cliente ({mesAtual})</h2>
          {tempo.length ? (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th className="num">Clientes</th>
                  <th className="num">Minutos</th>
                  <th className="num">Por cliente</th>
                </tr>
              </thead>
              <tbody>
                {tempo.map((t) => (
                  <tr key={t.plano}>
                    <td>
                      {t.plano}
                      <div className="legenda">
                        {Object.entries(t.porTipo)
                          .map(([k, v]) => `${TIPOS_TEMPO[k as keyof typeof TIPOS_TEMPO] ?? k} ${v} min`)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="num">{t.clientes}</td>
                    <td className="num">{t.minutos}</td>
                    <td className="num">{t.porCliente} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="secundario">Nenhum minuto registrado neste mês.</p>
          )}
          <p className="legenda">Meta do dossiê: até 49 minutos por cliente por mês no plano de R$ 497.</p>
          <FormAcao action={registrarTempo} className="pilha-8" limparAoSalvar>
            <CampoSelect nome="contaId" rotulo="Cliente" opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} vazio="Escolha o cliente" />
            <div className="linha-form">
              <CampoSelect nome="tipo" rotulo="Tipo" opcoes={Object.entries(TIPOS_TEMPO).map(([valor, rotulo]) => ({ valor, rotulo }))} vazio="Escolha" />
              <CampoTexto nome="minutos" rotulo="Minutos" inputMode="numeric" />
              <CampoData nome="data" rotulo="Data" valorInicial={paraInputData(hojeUTC())} mostrarRelativo={false} />
            </div>
            <CampoTexto nome="descricao" rotulo="O que foi feito" opcional maxLength={300} />
            <BotaoEnvio className="btn">Registrar tempo</BotaoEnvio>
          </FormAcao>
        </section>
        <section className="cartao">
          <h2>Pesquisa de encaixe (Sean Ellis)</h2>
          <p className="valor-n">{ellis.pct == null ? "—" : `${String(ellis.pct).replace(".", ",")}%`}</p>
          <p className="legenda mb-0">
            &ldquo;{RESPOSTAS_PESQUISA.MUITO_DECEPCIONADO}&rdquo; entre quem ainda usa: {ellis.muito} de {ellis.consideradas} ({ellis.respostas} respostas no total). Meta do dossiê: 40% ou mais.
          </p>
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
