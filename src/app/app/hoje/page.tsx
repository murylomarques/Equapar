import type { Metadata } from "next";
import Link from "next/link";
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
  const receber = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "DEFERIDO" || p.estado === "FATURADO").map((p) => ({ c, p })));
  const totalReceber = somarReais(receber.map(({ p }) => p.valorDeferido)); // L10
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

      <div className="cartoes-numero">
        <CartaoNumero
          href="/app/carteira?filtro=prazo30"
          icone={CalendarClock}
          rotulo="Contratos com prazo em 30 dias"
          valor={prazos30}
          detalhe={prazos30 ? "Ver os contratos" : "Nenhum prazo próximo"}
          tom={prazos30 ? "carimbo" : undefined}
        />
        <CartaoNumero
          href="/app/pedidos?estado=PROTOCOLADO"
          icone={Hourglass}
          rotulo="Aguardando o órgão"
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
                            texto={`Protocolado ${emDias(diasAte(p.protocoloData!))} · resposta preferencial até ${data(r)}${atrasado ? " (vencida)" : ""}`}
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
              <Link href="/app/a-receber">Ver tudo</Link>
            </div>
            {receber.length === 0 ? (
              <p className="secundario mt-8">Nada deferido aguardando pagamento.</p>
            ) : (
              <ul className="lista-limpa pilha-8 mt-16">
                {receber.slice(0, 4).map(({ c, p }) => (
                  <li key={p.id} className="cartao-linha entre">
                    <span>
                      Contrato {c.numero} · {c.orgao}
                    </span>
                    <span className="num">{reais(p.valorDeferido)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
                    <strong className="tnum">{data(evs[0].data)}</strong> · {emDias(d)}
                    {evs.length === 1 ? (
                      <>
                        <div>{evs[0].titulo}</div>
                        <Link href={`/app/contratos/${evs[0].contrato.id}?aba=prazos`} className="legenda">
                          Contrato {evs[0].contrato.numero} · {evs[0].contrato.orgao}
                        </Link>
                      </>
                    ) : (
                      <details>
                        <summary style={{ cursor: "pointer" }}>
                          {[...new Set(evs.map((e) => e.titulo.replace(/ \(.*\)$/, "")))].join("; ")} · {plural(new Set(evs.map((e) => e.contrato.id)).size, "contrato", "contratos")}
                        </summary>
                        <ul className="lista-limpa" style={{ marginTop: 4 }}>
                          {evs.map((e, i) => (
                            <li key={i} style={{ padding: "2px 0" }}>
                              <Link href={`/app/contratos/${e.contrato.id}?aba=prazos`} className="legenda">
                                Contrato {e.contrato.numero} · {e.contrato.orgao}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
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
