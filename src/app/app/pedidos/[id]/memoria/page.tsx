import type { Metadata } from "next";
import Link from "next/link";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, pct } from "@/lib/calculo/motor";
import { MODULOS } from "@/lib/calculo/tipos";
import { calcularPedido } from "@/lib/pedido";
import { data, dataHora, MESES, dataLocal } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { SeloSimples } from "@/components/selo";
import { aprovarMemoria, comentarLinha } from "../../acoes";

export const metadata: Metadata = { title: "Memória de cálculo | Equapar" };

export default async function Memoria({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const p = await pedidoDaConta(ctx, id);
  const calc = calcularPedido(p);
  const comp = calc.comparacao;
  const comentarios = await db.comentarioLinha.findMany({ where: { pedidoId: p.id }, include: { usuario: true }, orderBy: { criadoEm: "asc" } });
  const docConvencao = p.convencaoId ? await db.documento.findFirst({ where: { convencaoId: p.convencaoId }, orderBy: { criadoEm: "desc" } }) : null;
  const editavel = ["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado);
  const nomeModulo = (m: string) => MODULOS.find((x) => x.id === m)?.nome ?? m;

  return (
    <>
      <div className="app-cab">
        <div>
          <p className="legenda mb-0">
            <Link href={`/app/pedidos/${p.id}`}>
              Pedido · Contrato {p.contrato.numero} · {p.contrato.orgao}
            </Link>
          </p>
          <h1>Memória de cálculo</h1>
          <p className="legenda mb-0">
            Estrutura da IN SEGES/MP 05/2017, Anexo VII-D · regra {calc.versaoRegra} · cada linha arredondada a 2 casas · tributos por dentro
          </p>
        </div>
        <div className="fileira">
          {p.memoriaAprovadaEm ? (
            <SeloSimples texto={`Aprovada por ${p.memoriaAprovadaPor} em ${dataLocal(p.memoriaAprovadaEm)}`} tom="verde" icone="check" />
          ) : pode(ctx.papel, "aprovar_memoria") && editavel && calc.pronto ? (
            <FormAcao action={aprovarMemoria}>
              <input type="hidden" name="pedidoId" value={p.id} />
              <BotaoEnvio>Aprovar memória</BotaoEnvio>
            </FormAcao>
          ) : (
            <SeloSimples texto="Aprovação: só Contador ou Dono" tom="ambar" icone="relogio" />
          )}
        </div>
      </div>

      {!comp || comp.erros.length ? (
        <div className="cartao">
          <p className="erro-texto">A memória ainda não pode ser montada.</p>
          <ul>{comp?.erros.map((e) => <li key={e}>{e}</li>)}</ul>
          <Link href={`/app/pedidos/${p.id}/passo/3`}>Voltar ao passo 3</Link>
        </div>
      ) : (
        <div className="pilha" style={{ gap: 24 }}>
          <div className="cartao">
            <div className="grade-2">
              <div>
                <div className="legenda">Diferença por mês</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 600, textAlign: "left" }}>
                  {brl(comp.diferencaMensal)}
                </div>
                <div className="legenda">
                  {brl(comp.mensalAntes)} → {brl(comp.mensalAgora)} {comp.variacaoPct && `(${pct(comp.variacaoPct)})`}
                </div>
              </div>
              <div>
                <div className="legenda">
                  Desde a data-base ({p.dataBase ? `${MESES[p.dataBase.getUTCMonth()]} de ${p.dataBase.getUTCFullYear()}` : "não informada"}) até {data(calc.dataReferencia)}
                </div>
                <div className="num" style={{ fontSize: 26, fontWeight: 600, textAlign: "left" }}>
                  {calc.retroativo ? brl(calc.retroativo.total) : "—"}
                </div>
              </div>
            </div>
          </div>

          {comp.postos.map((posto) => {
            let mod = "";
            return (
              <section key={posto.id} className="cartao" style={{ padding: 0 }} aria-label={posto.nome}>
                <h2 style={{ padding: "20px 20px 0" }}>
                  {posto.nome} · {posto.quantidadeAgora} {posto.quantidadeAgora === 1 ? "posto" : "postos"}
                </h2>
                <div className="tabela-rolagem" style={{ border: 0, borderTop: "1px solid var(--linha)", borderRadius: 0 }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">Item e conta</th>
                        <th scope="col" className="num">
                          Valor anterior
                        </th>
                        <th scope="col" className="num">
                          Valor novo
                        </th>
                        <th scope="col" className="num">
                          Variação
                        </th>
                        <th scope="col">Comentários</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.linhas
                        .filter((l) => l.postoId === posto.id)
                        .flatMap((l) => {
                          const linhas = [];
                          if (l.modulo !== mod) {
                            mod = l.modulo;
                            linhas.push(
                              <tr key={`m-${l.id}`} className="modulo">
                                <td colSpan={5}>{nomeModulo(l.modulo)}</td>
                              </tr>,
                            );
                          }
                          const cs = comentarios.filter((c) => c.linhaId === l.id);
                          linhas.push(
                            <tr key={l.id}>
                              <td>
                                <strong style={{ fontWeight: 500 }}>{l.descricao}</strong>
                                <div className="legenda">{l.contaAgora}</div>
                                {l.fonte && (
                                  <div className="legenda">
                                    Fonte:{" "}
                                    {docConvencao && /cl[aá]usula|cct|conven/i.test(l.fonte) ? <a href={`/api/documentos/${docConvencao.id}`}>{l.fonte}</a> : l.fonte}
                                  </div>
                                )}
                              </td>
                              <td className="num">{brl(l.antes)}</td>
                              <td className="num">{brl(l.agora)}</td>
                              <td className="num">
                                {brl(l.variacao)}
                                {l.variacaoPct && <div className="legenda">{pct(l.variacaoPct)}</div>}
                              </td>
                              <td style={{ minWidth: 200 }}>
                                <details>
                                  <summary className="legenda" style={{ cursor: "pointer" }}>
                                    {cs.length ? `${cs.length} ${cs.length === 1 ? "comentário" : "comentários"}` : "Comentar"}
                                  </summary>
                                  <ul className="lista-limpa" style={{ margin: "6px 0", fontSize: 13 }}>
                                    {cs.map((c) => (
                                      <li key={c.id}>
                                        <strong>{c.usuario.nome}</strong> <span className="legenda">{dataHora(c.criadoEm)}</span>
                                        <div>{c.texto}</div>
                                      </li>
                                    ))}
                                  </ul>
                                  {ctx.papel !== "LEITURA" && (
                                    <FormAcao action={comentarLinha} limparAoSalvar>
                                      <input type="hidden" name="pedidoId" value={p.id} />
                                      <input type="hidden" name="linhaId" value={l.id} />
                                      <label className="sr-only" htmlFor={`c-${l.id}`}>
                                        Comentário
                                      </label>
                                      <textarea id={`c-${l.id}`} name="texto" style={{ minHeight: 56, fontSize: 13 }} />
                                      <BotaoEnvio className="btn btn-pequeno">Salvar</BotaoEnvio>
                                    </FormAcao>
                                  )}
                                </details>
                              </td>
                            </tr>,
                          );
                          return linhas;
                        })}
                      <tr className="total">
                        <td>Total por posto</td>
                        <td className="num">{brl(posto.porPostoAntes)}</td>
                        <td className="num">{brl(posto.porPostoAgora)}</td>
                        <td className="num" />
                        <td />
                      </tr>
                      <tr className="total">
                        <td>Total mensal ({posto.quantidadeAgora} postos)</td>
                        <td className="num">{brl(posto.mensalAntes)}</td>
                        <td className="num">{brl(posto.mensalAgora)}</td>
                        <td className="num" />
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {calc.retroativo && calc.retroativo.meses.length > 0 && (
            <section className="cartao">
              <h2>Diferença retroativa, mês a mês</h2>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Conta</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.retroativo.meses.map((m) => (
                    <tr key={m.competencia}>
                      <td>{m.competencia}</td>
                      <td>{m.conta}</td>
                      <td className="num">{brl(m.valor)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total</td>
                    <td />
                    <td className="num">{brl(calc.retroativo.total)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}
          <p className="legenda leitura">
            Os números vêm da planilha da proposta e da convenção informadas. A Equapar aplica a estrutura de cálculo; a revisão por profissional habilitado é recomendada antes do protocolo.
          </p>
        </div>
      )}
    </>
  );
}
