"use client";
import { useState, useSyncExternalStore } from "react";
import Decimal from "decimal.js";
import { ChevronDown, MessageSquare, Printer } from "lucide-react";
import { brl, pct } from "@/lib/calculo/motor";
import type { Comparacao, Retroativo } from "@/lib/calculo/motor";
import { MODULOS } from "@/lib/calculo/tipos";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { plural } from "@/lib/mascaras";
import { comentarLinha } from "../../acoes";
import { paginaDaFonte } from "@/lib/sugestoes-convencao";

const CELULAR = "(max-width: 720px)";
/** Variação exibida (só apresentação: os totais já vêm do motor; aqui é antes → agora). */
function variacao(antes: string, agora: string) {
  return new Decimal(agora).minus(new Decimal(antes)).toFixed(2);
}
function Delta({ v }: { v: string }) {
  const d = Number(v);
  if (d === 0) return <span className="secundario">sem mudança</span>;
  return (
    <span style={{ fontWeight: 600, color: d < 0 ? "var(--erro)" : "var(--verde)" }}>
      {d > 0 ? "+" : ""}
      {brl(v)}
    </span>
  );
}

function assinarCelular(aviso: () => void) {
  const m = window.matchMedia(CELULAR);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
}

interface Comentario {
  id: string;
  linhaId: string;
  autor: string;
  quando: string;
  texto: string;
}

export function MemoriaView({
  pedidoId,
  comp,
  retro,
  comentarios,
  podeComentar,
  linkConvencao,
}: {
  pedidoId: string;
  comp: Comparacao;
  retro: Retroativo | null;
  comentarios: Comentario[];
  podeComentar: boolean;
  linkConvencao: string | null;
}) {
  const mudaram = comp.linhas.filter((l) => l.variacao !== "0.00").length;
  // 5.2: no celular, "Só as linhas com valor diferente" vem ligado e a memória mostra um módulo por vez
  const celular = useSyncExternalStore(assinarCelular, () => window.matchMedia(CELULAR).matches, () => false);
  const [escolha, setSoMudou] = useState<boolean | null>(null);
  const soMudou = escolha ?? (celular && mudaram > 0);
  const [moduloCelular, setModuloCelular] = useState<Record<string, string>>({});
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [comentando, setComentando] = useState<string | null>(null);
  const nomeModulo = (m: string) => MODULOS.find((x) => x.id === m)?.nome ?? m;
  // 5.5: a fonte "Cláusula 4ª, p. 3" leva à página 3 do PDF da convenção
  const linkFonte = (fonte: string) => {
    const pg = paginaDaFonte(fonte);
    return pg ? `${linkConvencao}?ver=1#page=${pg}` : linkConvencao!;
  };

  return (
    <div className="pilha" style={{ gap: 24 }}>
      <div className="filtros mb-0 nao-imprimir entre">
        <div className="fileira" role="group" aria-label="Quais linhas mostrar">
          <button type="button" className="filtro" aria-pressed={!soMudou} onClick={() => setSoMudou(false)}>
            Todas as linhas <span className="n">({comp.linhas.length})</span>
          </button>
          <button type="button" className="filtro" aria-pressed={soMudou} onClick={() => setSoMudou(true)}>
            Linhas com valor diferente <span className="n">({mudaram})</span>
          </button>
        </div>
        <button type="button" className="btn btn-pequeno" onClick={() => window.print()}>
          <Printer size={16} strokeWidth={1.5} aria-hidden /> Imprimir ou salvar em PDF
        </button>
      </div>

      {comp.postos.map((posto) => {
        const linhas = comp.linhas.filter((l) => l.postoId === posto.id && (!soMudou || l.variacao !== "0.00"));
        const modulos = [...new Set(linhas.map((l) => l.modulo))];
        return (
          <section key={posto.id} className="cartao" style={{ padding: 0 }} aria-label={posto.nome}>
            <div className="entre" style={{ padding: "16px 20px" }}>
              <h2 className="mb-0">
                {posto.nome} · {plural(posto.quantidadeAgora, "posto", "postos")}
              </h2>
              <span className="comparacao">
                {brl(posto.porPostoAntes)} → <strong>{brl(posto.porPostoAgora)}</strong> por posto
              </span>
            </div>
            {modulos.length > 0 && (
              <div className="so-celular memoria-celular">
                <div className="campo mb-0" style={{ padding: "0 16px 12px" }}>
                  <label htmlFor={`mod-${posto.id}`}>Módulo</label>
                  <select
                    id={`mod-${posto.id}`}
                    value={(modulos as string[]).includes(moduloCelular[posto.id]) ? moduloCelular[posto.id] : modulos[0]}
                    onChange={(e) => setModuloCelular((m) => ({ ...m, [posto.id]: e.target.value }))}
                  >
                    {modulos.map((m) => (
                      <option key={m} value={m}>
                        {nomeModulo(m)} ({linhas.filter((l) => l.modulo === m).length})
                      </option>
                    ))}
                  </select>
                </div>
                <ul className="lista-limpa">
                  {linhas
                    .filter((l) => l.modulo === ((modulos as string[]).includes(moduloCelular[posto.id]) ? moduloCelular[posto.id] : modulos[0]))
                    .map((l) => {
                      const delta = Number(l.variacao);
                      return (
                        <li key={l.id} className="memoria-cartao">
                          <strong style={{ fontWeight: 500 }}>{l.descricao}</strong>
                          <div className="entre tnum">
                            <span>
                              {brl(l.antes)} → <strong>{brl(l.agora)}</strong>
                            </span>
                            {delta === 0 ? (
                              <span className="secundario">sem mudança</span>
                            ) : (
                              <span style={{ fontWeight: 600, color: delta < 0 ? "var(--erro)" : "var(--verde)" }}>
                                {delta > 0 ? "+" : ""}
                                {brl(l.variacao)}
                                {l.variacaoPct ? ` (${delta > 0 ? "+" : ""}${pct(l.variacaoPct)})` : ""}
                              </span>
                            )}
                          </div>
                          <div className="legenda">{l.contaAgora}</div>
                          {l.fonte && (
                            <div className="legenda">
                              Fonte: {linkConvencao && /cl[aá]usula|cct|conven/i.test(l.fonte) ? <a href={linkFonte(l.fonte)}>{l.fonte}</a> : l.fonte}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <div className="memoria-cartao" style={{ fontWeight: 600 }}>
                  <div className="entre">
                    <span>Total mensal</span>
                    <span className="tnum">
                      {brl(posto.mensalAntes)} → {brl(posto.mensalAgora)}
                    </span>
                  </div>
                  <div className="entre tnum">
                    <span className="legenda">Variação</span>
                    <Delta v={variacao(posto.mensalAntes, posto.mensalAgora)} />
                  </div>
                </div>
              </div>
            )}
            <div className="tabela-rolagem so-desktop-memoria" style={{ border: 0, borderTop: "1px solid var(--linha)", borderRadius: 0, boxShadow: "none" }}>
              <table className="tabela memoria-tabela">
                <thead>
                  <tr>
                    <th scope="col">Item e conta</th>
                    <th scope="col" className="num">
                      Antes
                    </th>
                    <th scope="col" className="num">
                      Agora
                    </th>
                    <th scope="col" className="num">
                      Variação
                    </th>
                    <th scope="col" className="nao-imprimir">
                      <span className="sr-only">Comentários</span>
                    </th>
                  </tr>
                </thead>
                {modulos.map((m) => {
                  const chave = `${posto.id}:${m}`;
                  const fechado = fechados.has(chave);
                  const ls = linhas.filter((l) => l.modulo === m);
                  return (
                    <tbody key={m}>
                      <tr className="modulo">
                        <td colSpan={5}>
                          <button
                            type="button"
                            className="modulo-toggle"
                            aria-expanded={!fechado}
                            onClick={() =>
                              setFechados((f) => {
                                const n = new Set(f);
                                if (n.has(chave)) n.delete(chave);
                                else n.add(chave);
                                return n;
                              })
                            }
                          >
                            <ChevronDown size={16} strokeWidth={1.5} aria-hidden style={{ transform: fechado ? "rotate(-90deg)" : undefined }} />
                            {nomeModulo(m)} <span className="legenda">({ls.length})</span>
                          </button>
                        </td>
                      </tr>
                      {!fechado &&
                        ls.flatMap((l) => {
                          const cs = comentarios.filter((c) => c.linhaId === l.id);
                          const delta = Number(l.variacao);
                          const linhas = [
                            <tr key={l.id}>
                              <td>
                                <strong style={{ fontWeight: 500 }}>{l.descricao}</strong>
                                <div className="legenda">{l.contaAgora}</div>
                                {l.fonte && (
                                  <div className="legenda">
                                    Fonte: {linkConvencao && /cl[aá]usula|cct|conven/i.test(l.fonte) ? <a href={linkFonte(l.fonte)}>{l.fonte}</a> : l.fonte}
                                  </div>
                                )}
                              </td>
                              <td className="num">{brl(l.antes)}</td>
                              <td className="num">{brl(l.agora)}</td>
                              <td className="num">
                                {delta === 0 ? (
                                  <span className="secundario">—</span>
                                ) : (
                                  <span className={delta < 0 ? "delta-menos" : "delta-mais"} style={{ fontWeight: 600, color: delta < 0 ? "var(--erro)" : "var(--verde)" }}>
                                    {delta > 0 ? "+" : ""}
                                    {brl(l.variacao)}
                                    {l.variacaoPct && <span className="legenda" style={{ display: "block", fontWeight: 400 }}>{`${delta > 0 ? "+" : ""}${pct(l.variacaoPct)}`}</span>}
                                  </span>
                                )}
                              </td>
                              <td className="nao-imprimir c-comentar">
                                {(podeComentar || cs.length > 0) && (
                                  <button
                                    type="button"
                                    className={`btn btn-discreto btn-pequeno btn-comentar${cs.length ? " tem" : ""}`}
                                    aria-expanded={comentando === l.id}
                                    aria-label={cs.length ? `${plural(cs.length, "comentário", "comentários")} sobre ${l.descricao}` : `Comentar ${l.descricao}`}
                                    title={cs.length ? "Ver comentários" : "Comentar esta linha"}
                                    onClick={() => setComentando(comentando === l.id ? null : l.id)}
                                  >
                                    <MessageSquare size={14} strokeWidth={1.5} aria-hidden />
                                    {cs.length > 0 && <span aria-hidden>{cs.length}</span>}
                                  </button>
                                )}
                              </td>
                            </tr>,
                          ];
                          if (comentando === l.id)
                            linhas.push(
                              <tr key={`${l.id}-c`} className="nao-imprimir">
                                <td colSpan={5} style={{ background: "var(--superficie-2)" }}>
                                  {cs.length > 0 && (
                                    <ul className="lista-limpa pilha-8" style={{ marginBottom: 8 }}>
                                      {cs.map((c) => (
                                        <li key={c.id} style={{ font: "var(--t-tabela)" }}>
                                          <strong>{c.autor}</strong> <span className="legenda">{c.quando}</span>
                                          <div>{c.texto}</div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {podeComentar && (
                                    <FormAcao action={comentarLinha} limparAoSalvar className="fileira" style={{ alignItems: "flex-end" }}>
                                      <input type="hidden" name="pedidoId" value={pedidoId} />
                                      <input type="hidden" name="linhaId" value={l.id} />
                                      <div className="campo mb-0" style={{ flex: 1 }}>
                                        <label htmlFor={`c-${l.id}`}>Comentário sobre {l.descricao}</label>
                                        <input id={`c-${l.id}`} name="texto" autoFocus />
                                      </div>
                                      <BotaoEnvio className="btn">Salvar comentário</BotaoEnvio>
                                    </FormAcao>
                                  )}
                                </td>
                              </tr>,
                            );
                          return linhas;
                        })}
                    </tbody>
                  );
                })}
                <tbody>
                  <tr className="total">
                    <td>Total mensal ({plural(posto.quantidadeAgora, "posto", "postos")})</td>
                    <td className="num">{brl(posto.mensalAntes)}</td>
                    <td className="num">{brl(posto.mensalAgora)}</td>
                    <td className="num">
                      <Delta v={variacao(posto.mensalAntes, posto.mensalAgora)} />
                    </td>
                    <td className="nao-imprimir" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {comp.postos.length > 1 && (
        <section className="cartao memoria-total-geral" aria-label="Total do contrato">
          <h2 className="mb-0">Total do contrato · {plural(comp.postos.length, "tipo de posto", "tipos de posto")}</h2>
          <dl className="memoria-total-dl">
            <div>
              <dt>Mensal antes</dt>
              <dd className="num">{brl(comp.mensalAntes)}</dd>
            </div>
            <div>
              <dt>Mensal agora</dt>
              <dd className="num">{brl(comp.mensalAgora)}</dd>
            </div>
            <div>
              <dt>Diferença por mês</dt>
              <dd className="num">
                <Delta v={comp.diferencaMensal} />
                {comp.variacaoPct && <span className="legenda"> ({pct(comp.variacaoPct)})</span>}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {retro && retro.meses.length > 0 && (
        <section className="cartao">
          <h2>Diferença retroativa, mês a mês</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Competência</th>
                <th scope="col" className="so-desktop">
                  Conta
                </th>
                <th scope="col" className="num">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {retro.meses.map((m) => (
                <tr key={m.competencia}>
                  <td className="tnum">
                    {competenciaBr(m.competencia)}
                    {/* celular: a conta vira uma linha embaixo do mês (a coluna quebrava o valor em 3 a 5 linhas) */}
                    <div className="legenda so-celular">{m.conta}</div>
                  </td>
                  <td className="so-desktop">{m.conta}</td>
                  <td className="num">{brl(m.valor)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="so-desktop" />
                <td className="num">{brl(retro.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-01" → "jan/2026" (a competência continua com a mesma chave; só a leitura muda). */
function competenciaBr(c: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1]}` : c;
}
