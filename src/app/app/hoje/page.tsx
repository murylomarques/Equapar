import type { Metadata } from "next";
import Link from "next/link";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { contratosDoContexto } from "@/lib/consultas";
import { acoesDoContrato, prazoResposta, prazosDoContrato } from "@/lib/prazos";
import { addDias, data, diasAte, emDias, hojeUTC, reais, reaisResumo, saudacao } from "@/lib/format";
import { SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { concluirTarefa } from "../acoes";

export const metadata: Metadata = { title: "Hoje | Equapar" };

export default async function Hoje() {
  const ctx = await contexto();
  const hoje = hojeUTC();
  const contratos = await contratosDoContexto(ctx);
  if (contratos.length === 0) {
    return (
      <div className="cartao vazio">
        <h1>Bom começo.</h1>
        <p>Nenhum contrato ainda. Importe do PNCP pelo CNPJ ou cadastre à mão.</p>
        <div className="fileira" style={{ justifyContent: "center" }}>
          <Link href="/app/boas-vindas" className="btn btn-primario">
            Importar do PNCP
          </Link>
          <Link href="/app/contratos/novo" className="btn">
            Cadastrar à mão
          </Link>
        </div>
      </div>
    );
  }

  const leitura = !pode(ctx.papel, "editar_pedidos");
  const acoes = contratos
    .flatMap((c) => acoesDoContrato(c, hoje))
    .map((a) => (leitura ? { ...a, botao: "Ver contrato", href: `/app/contratos/${a.contratoId}` } : a))
    .sort((a, b) => (a.limite?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.limite?.getTime() ?? Number.MAX_SAFE_INTEGER));
  const tarefas = await db.tarefa.findMany({
    where: { contaId: ctx.conta.id, feitaEm: null, ...(ctx.empresaId ? { contrato: { empresaId: ctx.empresaId } } : {}) },
    include: { contrato: true },
    orderBy: { criadoEm: "asc" },
  });
  const aguardando = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "PROTOCOLADO").map((p) => ({ c, p })));
  const receber = contratos.flatMap((c) => c.pedidos.filter((p) => p.estado === "DEFERIDO" || p.estado === "FATURADO").map((p) => ({ c, p })));
  const totalReceber = receber.reduce((s, { p }) => s + Number(p.valorDeferido ?? 0), 0);
  const prazosSemana = acoes.filter((a) => a.limite && diasAte(a.limite) <= 7).length;
  const ate90 = addDias(hoje, 90);
  const linhaTempo = contratos
    .flatMap((c) => prazosDoContrato(c, hoje).map((p) => ({ ...p, contrato: c })))
    .filter((p) => p.data >= hoje && p.data <= ate90)
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const proximo = contratos.flatMap((c) => prazosDoContrato(c, hoje).map((p) => ({ ...p, contrato: c }))).find((p) => p.data >= hoje);
  const podeEditar = pode(ctx.papel, "editar_contratos");

  return (
    <>
      <div className="app-cab">
        <div>
          <h1>Hoje</h1>
          <p className="mt-16 mb-0" style={{ fontSize: 17 }}>
            {saudacao()}, {ctx.usuario.nome.split(" ")[0]}. Esta semana: {prazosSemana} {prazosSemana === 1 ? "prazo" : "prazos"}, {aguardando.length}{" "}
            {aguardando.length === 1 ? "pedido aguardando" : "pedidos aguardando"} o órgão e {reaisResumo(totalReceber)} a receber.
          </p>
        </div>
      </div>

      <div className="hoje">
        <div className="pilha" style={{ gap: 32 }}>
          <section aria-labelledby="precisa">
            <h2 id="precisa">Precisa de você</h2>
            {acoes.length === 0 && tarefas.length === 0 ? (
              <p className="secundario">{proximo ? `Nenhum prazo nas próximas 4 semanas. O próximo é em ${data(proximo.data)}: contrato ${proximo.contrato.numero}.` : "Nada pendente."}</p>
            ) : (
              <ul className="lista-limpa pilha-8">
                {acoes.map((a) => (
                  <li key={a.chave} className={`item-acao tom-${a.tom}`}>
                    <div>
                      <strong>{a.titulo}</strong> · Contrato {a.contratoNumero} · {a.orgao}
                      <div className="fileira" style={{ marginTop: 6 }}>
                        <SeloSimples texto={a.detalhe} tom={a.tom} icone={a.tom === "verde" ? "cifrao" : "relogio"} />
                        {a.limite && <span className="legenda">até {data(a.limite)}</span>}
                      </div>
                    </div>
                    <Link href={a.href} className={a === acoes[0] ? "btn btn-primario" : "btn"}>
                      {a.botao}
                    </Link>
                  </li>
                ))}
                {tarefas.map((t) => (
                  <li key={t.id} className="item-acao tom-ambar">
                    <div>
                      <strong>{t.titulo}</strong>
                      {t.contrato && (
                        <>
                          {" "}
                          · <Link href={`/app/contratos/${t.contrato.id}`}>Contrato {t.contrato.numero}</Link> · {t.contrato.orgao}
                        </>
                      )}
                    </div>
                    {podeEditar && (
                      <FormAcao action={concluirTarefa}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn" type="submit">
                          Concluir
                        </button>
                      </FormAcao>
                    )}
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
                      <div>
                        <strong>Contrato {c.numero}</strong> · {c.orgao}
                        <div style={{ marginTop: 6 }}>
                          <SeloSimples
                            texto={`Protocolado ${emDias(diasAte(p.protocoloData!))} · prazo preferencial de resposta: 1 mês${atrasado ? " (vencido)" : ""}`}
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
              <h2 id="receber">A receber</h2>
              <Link href="/app/a-receber">Ver tudo</Link>
            </div>
            <p style={{ fontSize: 20, fontWeight: 600 }} className="num" title={reais(totalReceber)}>
              {reaisResumo(totalReceber)}
            </p>
            <ul className="lista-limpa pilha-8">
              {receber.slice(0, 4).map(({ c, p }) => (
                <li key={p.id} className="entre" style={{ fontSize: 14 }}>
                  <span>
                    Contrato {c.numero} · {c.orgao}
                  </span>
                  <span className="num">{reais(p.valorDeferido)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="linha-tempo-col cartao" aria-labelledby="proximos90">
          <h2 id="proximos90">Próximos 90 dias</h2>
          {linhaTempo.length === 0 ? (
            <p className="secundario">Nenhum prazo nos próximos 90 dias.</p>
          ) : (
            <ol className="linha-tempo">
              {linhaTempo.map((p, i) => (
                <li key={i} className={diasAte(p.data) <= 30 ? "urgente" : undefined}>
                  <strong>{data(p.data)}</strong> · {emDias(diasAte(p.data))}
                  <div>{p.titulo}</div>
                  <Link href={`/app/contratos/${p.contrato.id}?aba=prazos`} className="legenda">
                    Contrato {p.contrato.numero} · {p.contrato.orgao}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}
