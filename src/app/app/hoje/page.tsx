import type { Metadata } from "next";
import Link from "next/link";
import { resumoFinanceiro } from "@/lib/financeiro-pedido";
import { CalendarClock, CheckCircle2, DollarSign, FolderOpen, Hourglass } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { contratosDoContexto } from "@/lib/consultas";
import { acoesDoContrato, contratosComPrazoEm, prazoResposta, prazosDoContrato } from "@/lib/prazos";
import { addDias, data, diasAte, emDias, hojeUTC, plural, reais, reaisResumo, saudacao, somarReais } from "@/lib/format";
import { SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CartaoNumero, EstadoVazio } from "@/components/ui/apresentacao";
import { concluirTarefa } from "../acoes";
import { mostrarPesquisa } from "@/lib/metricas";
import { ehDemo } from "@/lib/auth";
import { PesquisaEncaixe } from "./pesquisa";

export const metadata: Metadata = { title: "Hoje | Equapar" };

export default async function Hoje() {
  const ctx = await contexto();
  const hoje = hojeUTC();
  const contratos = await contratosDoContexto(ctx);
  if (contratos.length === 0) {
    return (
      <>
        <h1>Hoje</h1>
        <EstadoVazio
          icone={FolderOpen}
          titulo="Nenhum contrato na carteira"
          porque="Os prazos aparecem aqui quando a carteira tiver contratos. Importe os contratos publicados no PNCP pelo CNPJ ou cadastre à mão."
          acao={
            <>
              <Link href="/app/boas-vindas" className="btn btn-primario">
                Importar do PNCP
              </Link>
              <Link href="/app/contratos/novo" className="btn">
                Cadastrar à mão
              </Link>
            </>
          }
        />
      </>
    );
  }

  const leitura = !pode(ctx.papel, "editar_pedidos");
  // F1: o primeiro dossiê gerado da conta (a pesquisa só aparece 7 dias depois dele)
  const primeiroDossie = (await db.pedido.findFirst({ where: { contrato: { empresa: { contaId: ctx.conta.id } }, geradoEm: { not: null } }, orderBy: { geradoEm: "asc" }, select: { geradoEm: true } }))?.geradoEm ?? null;
  const tarefas = await db.tarefa.findMany({
    where: { contaId: ctx.conta.id, feitaEm: null, ...(ctx.empresaId ? { contrato: { empresaId: ctx.empresaId } } : {}) },
    include: { contrato: true },
    orderBy: { criadoEm: "asc" },
  });
  const contratosComTarefaConvencao = new Set(tarefas.filter((t) => /conven/i.test(t.titulo)).map((t) => t.contratoId));
  const acoes = contratos
    .flatMap((c) => acoesDoContrato(c, hoje))
    // B3: a regra "Informar a convenção" e a tarefa "Descobrir a convenção" do mesmo contrato viram uma só (fica a tarefa)
    .filter((a) => !(a.chave.startsWith("conv:") && contratosComTarefaConvencao.has(a.contratoId)))
    .map((a) => (leitura ? { ...a, botao: "Ver contrato", href: `/app/contratos/${a.contratoId}` } : a))
    .sort((a, b) => (a.limite?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.limite?.getTime() ?? Number.MAX_SAFE_INTEGER));

  const aguardando = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "PROTOCOLADO").map((p) => ({ c, p })));
  const receberBase = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "DEFERIDO" || p.estado === "FATURADO").map((p) => ({ c, p })));
  // o mesmo saldo da tela A receber: retroativo aprovado menos o que já entrou (notas e baixas válidas)
  const lancamentos = receberBase.length
    ? await db.pedido.findMany({
        where: { id: { in: receberBase.map(({ p }) => p.id) } },
        select: { id: true, notasFiscais: { select: { id: true, valor: true, canceladaEm: true } }, baixas: { select: { notaFiscalId: true, valor: true, canceladaEm: true } } },
      })
    : [];
  const lancDe = new Map(lancamentos.map((l) => [l.id, l]));
  const receber = receberBase.map(({ c, p }) => ({
    c,
    p,
    pendente: resumoFinanceiro(p.retroativoAprovado ?? p.valorDeferido ?? 0, lancDe.get(p.id)?.notasFiscais ?? [], lancDe.get(p.id)?.baixas ?? []).totalPendente,
  }));
  const totalReceber = somarReais(receber.map((x) => x.pendente)); // L10
  // L1: mesmo conjunto do filtro "Prazo em 30 dias" da Carteira e do resumo semanal
  const prazos30 = contratosComPrazoEm(contratos, 30, hoje).length;

  const ate90 = addDias(hoje, 90);
  const eventos = contratos
    .flatMap((c) => prazosDoContrato(c, hoje).map((p) => ({ ...p, contrato: c })))
    .filter((p) => p.data >= hoje && p.data <= ate90)
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const porData = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const k = e.data.toISOString().slice(0, 10);
    porData.set(k, [...(porData.get(k) ?? []), e]);
  }
  const proximo = contratos
    .flatMap((c) => prazosDoContrato(c, hoje).map((p) => ({ ...p, contrato: c })))
    .filter((p) => p.data >= hoje)
    .sort((a, b) => a.data.getTime() - b.data.getTime())[0];
  const podeEditar = pode(ctx.papel, "editar_contratos");
  const tudoEmDia = acoes.length === 0 && tarefas.length === 0;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1>Hoje</h1>
        <p className="mb-0" style={{ fontSize: 17 }}>
          {saudacao()}, {ctx.usuario.nome.split(" ")[0]}. Próximos 30 dias: {plural(prazos30, "contrato com prazo", "contratos com prazo")}.
        </p>
      </div>

      <div className="cartoes-numero faixa-numeros">
        <CartaoNumero
          href="/app/carteira?filtro=prazo30"
          icone={CalendarClock}
          rotulo="Contratos com prazo em 30 dias"
          rotuloCurto="Prazo em 30 dias"
          valor={prazos30}
          detalhe={prazos30 ? "Ver os contratos" : "Nenhum prazo próximo"}
          tom={prazos30 ? "carimbo" : undefined}
        />
        <CartaoNumero
          href="/app/pedidos?estado=PROTOCOLADO"
          icone={Hourglass}
          rotulo="Aguardando o órgão"
          rotuloCurto="No órgão"
          valor={aguardando.length}
          detalhe={plural(aguardando.length, "pedido protocolado", "pedidos protocolados")}
          tom="azul"
        />
        <CartaoNumero
          href="/app/a-receber"
          icone={DollarSign}
          rotulo="A receber"
          valor={<span title={reais(totalReceber)}>{reaisResumo(totalReceber)}</span>}
          detalhe={plural(receber.length, "valor deferido", "valores deferidos")}
          tom="verde"
        />
      </div>

      <div className="hoje">
        <div className="pilha" style={{ gap: 32 }}>
          <section aria-labelledby="precisa">
            <h2 id="precisa">Precisa de você</h2>
            {tudoEmDia ? (
              <div className="cartao estado-vazio" style={{ padding: 24 }}>
                <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden style={{ color: "var(--verde)" }} />
                <h3>Tudo em dia</h3>
                <p className="mb-0">
                  {proximo ? `O próximo prazo é em ${data(proximo.data)}: ${proximo.titulo.toLowerCase()} do contrato ${proximo.contrato.numero}.` : "Nenhum prazo na carteira."}
                </p>
              </div>
            ) : (
              <ul className="lista-limpa pilha-8">
                {acoes.map((a, i) => (
                  <li key={a.chave} className={`item-acao tom-${a.tom}`}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{a.titulo}</strong> · Contrato {a.contratoNumero} · {a.orgao}
                      <div className="fileira" style={{ marginTop: 6 }}>
                        <SeloSimples texto={a.detalhe} tom={a.tom} icone={a.tom === "verde" ? "cifrao" : a.limite ? "relogio" : "alerta"} />
                        {a.limite && <span className="legenda">até {data(a.limite)}</span>}
                      </div>
                    </div>
                    <Link href={a.href} className={i === 0 && !leitura ? "btn btn-primario" : "btn"}>
                      {a.botao}
                    </Link>
                  </li>
                ))}
                {tarefas.map((t) => (
                  <li key={t.id} className="item-acao tom-ambar">
                    <div style={{ minWidth: 0 }}>
                      <strong>{t.titulo}</strong>
                      {t.contrato && (
                        <>
                          {" "}
                          · Contrato {t.contrato.numero} · {t.contrato.orgao}
                        </>
                      )}
                      {/conven/i.test(t.titulo) && (
                        <div style={{ marginTop: 6 }}>
                          <SeloSimples texto="sem ela não há como avisar a data-base" tom="ambar" icone="alerta" />
                        </div>
                      )}
                    </div>
                    <div className="fileira">
                      {t.contrato && (
                        <Link href={`/app/contratos/${t.contrato.id}?editar=1`} className="btn">
                          {leitura ? "Ver contrato" : "Informar a convenção"}
                        </Link>
                      )}
                      {podeEditar && (
                        <FormAcao action={concluirTarefa}>
                          <input type="hidden" name="id" value={t.id} />
                          <BotaoEnvio className="btn btn-discreto">Concluir</BotaoEnvio>
                        </FormAcao>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="aguardando">
            <h2 id="aguardando">Aguardando o órgão</h2>
            {aguardando.length === 0 ? (
              <p className="secundario">Nenhum pedido aguardando resposta.</p>
            ) : (
              <ul className="lista-limpa pilha-8">
                {aguardando.map(({ c, p }) => {
                  const r = prazoResposta(p);
                  const atrasado = r && diasAte(r) < 0;
                  return (
                    <li key={p.id} className="item-acao tom-azul">
                      <div style={{ minWidth: 0 }}>
                        <strong>Contrato {c.numero}</strong> · {c.orgao}
                        <div style={{ marginTop: 6 }}>
                          <SeloSimples
                            texto={
                              r
                                ? `Protocolado ${emDias(diasAte(p.protocoloData!))} · resposta preferencial até ${data(r)}${atrasado ? " (vencida)" : ""}`
                                : `Protocolado ${emDias(diasAte(p.protocoloData!))} · prazo de resposta: falta a data da documentação completa`
                            }
                            tom={atrasado ? "carimbo" : "azul"}
                            icone="ampulheta"
                          />
                        </div>
                      </div>
                      <Link href={`/app/pedidos/${p.id}/pronto`} className="btn">
                        {leitura ? "Ver pedido" : "Registrar resposta"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="receber">
            <div className="entre">
              <h2 id="receber" className="mb-0">
                A receber
              </h2>
              <Link href="/app/a-receber" className="link-ver-tudo">
                Ver tudo
              </Link>
            </div>
            {receber.length === 0 ? (
              <p className="secundario mt-8">Nada deferido aguardando pagamento.</p>
            ) : (
              <ul className="lista-limpa pilha-8 mt-16">
                {receber.slice(0, 4).map(({ c, p, pendente }) => (
                  <li key={p.id} className="cartao-linha entre">
                    <span>
                      Contrato {c.numero} · {c.orgao}
                    </span>
                    <span className="num">{reais(pendente)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* a pesquisa fica no fim da coluna principal: no celular, a primeira tela é o trabalho do dia */}
          {!ehDemo(ctx) && mostrarPesquisa(ctx.conta, primeiroDossie) && <PesquisaEncaixe />}
        </div>

        <aside className="linha-tempo-col cartao" aria-labelledby="proximos90">
          <h2 id="proximos90">Próximos 90 dias</h2>
          {porData.size === 0 ? (
            <p className="secundario">Nenhum prazo nos próximos 90 dias.</p>
          ) : (
            <ol className="linha-tempo">
              {[...porData.entries()].map(([dia, evs]) => {
                const d = diasAte(evs[0].data);
                return (
                  <li key={dia} className={d <= 30 ? "urgente" : undefined}>
                    <strong className="tnum">{data(evs[0].data)}</strong> <span className="legenda">· {emDias(d)}</span>
                    <ul className="lista-limpa eventos-dia">
                      {agruparEventos(evs).map(({ titulo, contratos: cs }) => (
                        <li key={titulo}>
                          <span className="evento-linha">
                            <span className="evento-titulo" title={titulo}>
                              {titulo}
                            </span>
                            {cs.length > 1 && (
                              <span className="evento-contagem">
                                {cs.length}
                                <span className="sr-only"> contratos</span>
                              </span>
                            )}
                          </span>
                          {cs.map((c) => (
                            <Link key={c.id} href={`/app/contratos/${c.id}?aba=prazos`} className="legenda evento-contrato" title={`Contrato ${c.numero} · ${c.orgao}`}>
                              Contrato {c.numero} · {c.orgao}
                            </Link>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}

/** Agrupa os prazos do mesmo dia pelo título (sem o detalhe entre parênteses), um contrato por linha. */
function agruparEventos<E extends { titulo: string; contrato: { id: string; numero: string; orgao: string } }>(evs: E[]) {
  const grupos = new Map<string, Map<string, E["contrato"]>>();
  for (const e of evs) {
    const t = e.titulo.replace(/ \(.*\)$/, "");
    const g = grupos.get(t) ?? new Map<string, E["contrato"]>();
    g.set(e.contrato.id, e.contrato);
    grupos.set(t, g);
  }
  return [...grupos.entries()].map(([titulo, g]) => ({ titulo, contratos: [...g.values()] }));
}
