"use client";
import { AlertTriangle, ChevronDown, Monitor, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { brl, calcularPlanilha, calcularRetroativo, compararPlanilhas, pct, validarPlanilha } from "@/lib/calculo/motor";
import { BASES_PERMITIDAS, MODULOS, NOME_BASE, type BaseId, type LinhaPlanilha, type ModuloId, type PlanilhaCustos } from "@/lib/calculo/tipos";
import { novoId, postoModelo } from "@/lib/calculo/modelo";
import { plural } from "@/lib/mascaras";
import { Spinner } from "@/components/ui/espera";
import { CampoData } from "@/components/ui/campos";
import { useConfirmar } from "@/components/ui/provedores";
import { salvarPlanilha } from "./acoes";

/** "1.820,00" -> "1820.00"; "8,33" -> "8.33"; "1.820" -> "1820" (percentuais aceitam até 4 casas para não perder precisão da planilha). */
function normalizar(v: string) {
  let s = v.replace(/\s|R\$|%/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return s;
}
const exibir = (v: string) => v.replace(".", ",");
const valido = (v: string) => /^-?\d+(\.\d+)?$/.test(v);

type EstadoSalvo = { tipo: "ocioso" } | { tipo: "salvando" } | { tipo: "salvo"; texto: string } | { tipo: "erro"; texto: string };
type Posto = PlanilhaCustos["tipos"][number];

export function EditorPlanilha({
  pedidoId,
  qual,
  inicial,
  antes,
  dataBase,
  dataReferenciaInicial,
  somenteLeitura,
  formReferencia,
}: {
  pedidoId: string;
  qual: "antes" | "agora";
  inicial: PlanilhaCustos;
  antes?: PlanilhaCustos;
  dataBase?: string | null;
  dataReferenciaInicial?: string;
  somenteLeitura?: boolean;
  formReferencia?: string;
}) {
  const [planilha, setPlanilha] = useState<PlanilhaCustos>(inicial);
  const [salvo, setSalvo] = useState<EstadoSalvo>({ tipo: "ocioso" });
  const [, iniciar] = useTransition();
  const [alterada, setAlterada] = useState<string | null>(null);
  const [aba, setAba] = useState(inicial.tipos[0]?.id ?? "");
  const [dataRef, setDataRef] = useState<string | null>(dataReferenciaInicial ?? null);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [moduloCelular, setModuloCelular] = useState<ModuloId>("M1");
  const confirmar = useConfirmar();
  // Último conteúdo gravado: só salva quando o conteúdo realmente muda.
  // (Um "primeira vez" não basta: o React monta duas vezes em desenvolvimento e o editor
  // gravava a planilha antiga por cima de um envio novo.)
  const ultimoSalvo = useRef(JSON.stringify(inicial));
  const tabela = useRef<HTMLDivElement>(null);

  // ----- salvamento automático
  const salvar = useCallback(
    (p: PlanilhaCustos) => {
      const conteudo = JSON.stringify(p);
      setSalvo({ tipo: "salvando" });
      iniciar(async () => {
        const r = await salvarPlanilha(pedidoId, qual, conteudo);
        if (!r.erro) ultimoSalvo.current = conteudo;
        setSalvo(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "salvo", texto: r.ok ?? "Salvo" });
      });
    },
    [pedidoId, qual],
  );
  useEffect(() => {
    if (somenteLeitura || JSON.stringify(planilha) === ultimoSalvo.current) return;
    const t = setTimeout(() => salvar(planilha), 800);
    return () => clearTimeout(t);
  }, [planilha, somenteLeitura, salvar]);

  // ----- cálculos (o mesmo motor determinístico do servidor)
  const erros = useMemo(() => validarPlanilha(planilha), [planilha]);
  const resultado = useMemo(() => (erros.length ? null : calcularPlanilha(planilha)), [planilha, erros]);
  const comparacao = useMemo(() => (antes && !erros.length ? compararPlanilhas(antes, planilha) : null), [antes, planilha, erros]);
  const retro = useMemo(() => {
    if (!comparacao || comparacao.erros.length || !dataBase || !dataRef) return null;
    return calcularRetroativo(comparacao.diferencaMensal, new Date(`${dataBase}T00:00:00Z`), new Date(`${dataRef}T00:00:00Z`));
  }, [comparacao, dataBase, dataRef]);

  // linhas digitadas de forma diferente da planilha atual (modo "agora")
  const mudou = useMemo(() => {
    const s = new Set<string>();
    if (!antes) return s;
    for (const t of planilha.tipos) {
      const ta = antes.tipos.find((x) => x.id === t.id);
      for (const l of t.linhas) {
        const la = ta?.linhas.find((x) => x.id === l.id);
        if (!la || la.valor !== l.valor || la.tipo !== l.tipo || la.base !== l.base) s.add(`${t.id}:${l.id}`);
      }
    }
    return s;
  }, [antes, planilha]);
  const faltaFonte = [...mudou].filter((k) => {
    const [tid, lid] = k.split(":");
    return !planilha.tipos.find((t) => t.id === tid)?.linhas.find((l) => l.id === lid)?.fonte?.trim();
  }).length;
  const totalLinhas = planilha.tipos.reduce((s, t) => s + t.linhas.length, 0);
  const [soMudou, setSoMudou] = useState<boolean>(!!antes && mudou.size > 0);

  // ----- edição
  const mudarPosto = (pid: string, f: (p: Posto) => Posto) => setPlanilha((pl) => ({ tipos: pl.tipos.map((t) => (t.id === pid ? f(t) : t)) }));
  const mudarLinha = (pid: string, lid: string, patch: Partial<LinhaPlanilha>) => {
    setAlterada(lid);
    mudarPosto(pid, (t) => ({
      ...t,
      linhas: t.linhas.map((l) => {
        if (patch.salarioBase && l.id !== lid) return { ...l, salarioBase: undefined };
        return l.id === lid ? { ...l, ...patch } : l;
      }),
    }));
  };
  const adicionarLinha = (pid: string, m: (typeof MODULOS)[number]) => {
    setSoMudou(false);
    mudarPosto(pid, (x) => {
      const nova: LinhaPlanilha = {
        id: novoId(),
        modulo: m.id,
        descricao: "",
        tipo: m.id === "M6_TRIBUTOS" || m.basePadrao === "M1" || m.basePadrao === "M1_M21" ? "PERCENTUAL" : "VALOR",
        base: m.basePadrao,
        valor: "0",
      };
      const idx = x.linhas.map((l) => l.modulo).lastIndexOf(m.id);
      const linhas = [...x.linhas];
      if (idx >= 0) linhas.splice(idx + 1, 0, nova);
      else {
        const ordem = MODULOS.findIndex((mm) => mm.id === m.id);
        const pos = linhas.findIndex((l) => MODULOS.findIndex((mm) => mm.id === l.modulo) > ordem);
        linhas.splice(pos < 0 ? linhas.length : pos, 0, nova);
      }
      return { ...x, linhas };
    });
  };

  /** Colar várias células do Excel na coluna Valor: preenche a linha atual e as seguintes do mesmo posto. */
  const colar = (pid: string, lid: string, texto: string) => {
    const valores = texto
      .split(/\r?\n/)
      .map((l) => l.split("\t").pop() ?? "")
      .filter((v) => v.trim() !== "");
    if (valores.length < 2) return false;
    mudarPosto(pid, (t) => {
      const i = t.linhas.findIndex((l) => l.id === lid);
      return { ...t, linhas: t.linhas.map((l, j) => (j >= i && j - i < valores.length ? { ...l, valor: normalizar(valores[j - i]) } : l)) };
    });
    return true;
  };

  /** Enter desce para a mesma coluna da próxima linha (Shift+Enter sobe). */
  const aoTeclar = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.target as HTMLElement;
    const todos = [...(tabela.current?.querySelectorAll<HTMLElement>(`[data-col="${el.dataset.col}"]`) ?? [])];
    todos[todos.indexOf(el) + (e.shiftKey ? -1 : 1)]?.focus();
  };

  const posto = planilha.tipos.find((t) => t.id === aba) ?? planilha.tipos[0];
  const calcPosto = resultado?.postos.find((p) => p.id === posto?.id);
  const visivel = (l: LinhaPlanilha) => !soMudou || !antes || mudou.has(`${posto.id}:${l.id}`);

  return (
    <div className="assistente">
      <div className="pilha" style={{ gap: 12 }} ref={tabela}>
        <div className="so-celular alerta alerta-info">
          <Monitor size={20} strokeWidth={1.5} aria-hidden />
          <p>É mais confortável no computador. Seu progresso fica salvo.</p>
        </div>

        <div className="abas" role="tablist" aria-label="Tipos de posto" style={{ marginBottom: 0 }}>
          {planilha.tipos.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === posto?.id} onClick={() => setAba(t.id)}>
              {t.nome || "Sem nome"} · {plural(t.quantidade, "posto", "postos")}
            </button>
          ))}
          {!somenteLeitura && (
            <button
              type="button"
              onClick={() => {
                const novo = postoModelo(`Posto ${planilha.tipos.length + 1}`);
                setPlanilha((pl) => ({ tipos: [...pl.tipos, novo] }));
                setAba(novo.id);
                setSoMudou(false);
              }}
            >
              <Plus size={14} strokeWidth={1.5} aria-hidden /> tipo de posto
            </button>
          )}
        </div>
        <div aria-live="polite" style={{ minHeight: 24 }}>
          {salvo.tipo === "salvando" && (
            <span className="salvo">
              <Spinner /> Salvando…
            </span>
          )}
          {salvo.tipo === "salvo" && <span className="salvo">{salvo.texto}</span>}
          {salvo.tipo === "erro" && (
            <span className="erro-texto" style={{ alignItems: "center" }}>
              Não salvou.
              <button type="button" className="btn btn-discreto btn-pequeno" onClick={() => salvar(planilha)}>
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden /> Tentar de novo
              </button>
            </span>
          )}
        </div>

        {antes && (
          <div className="filtros mb-0" role="group" aria-label="Quais linhas mostrar">
            <button type="button" className="filtro" aria-pressed={soMudou} onClick={() => setSoMudou(true)}>
              Mostrar só o que mudou <span className="n">({mudou.size})</span>
            </button>
            <button type="button" className="filtro" aria-pressed={!soMudou} onClick={() => setSoMudou(false)}>
              Mostrar todas <span className="n">({totalLinhas})</span>
            </button>
            {faltaFonte > 0 && (
              <span className="selo selo-ambar">
                <AlertTriangle size={14} strokeWidth={1.5} aria-hidden /> {plural(faltaFonte, "linha alterada sem fonte", "linhas alteradas sem fonte")}
              </span>
            )}
          </div>
        )}
        {antes && soMudou && mudou.size === 0 && <p className="secundario">Nenhuma linha mudou ainda. Mostre todas e atualize pisos, benefícios e encargos da convenção nova.</p>}

        {posto && (
          <div className="cartao" style={{ padding: 16 }}>
            <div className="linha-form posto-cab">
              <div className="campo mb-0">
                <label htmlFor={`nome-${posto.id}`}>Tipo de posto</label>
                <input id={`nome-${posto.id}`} value={posto.nome} disabled={somenteLeitura} onChange={(e) => mudarPosto(posto.id, (x) => ({ ...x, nome: e.target.value }))} />
              </div>
              <div className="campo mb-0">
                <label htmlFor={`qtd-${posto.id}`}>Quantidade</label>
                <div className="entrada com-sufixo">
                  <input
                    id={`qtd-${posto.id}`}
                    inputMode="numeric"
                    className="valor-num"
                    value={posto.quantidade}
                    disabled={somenteLeitura}
                    onChange={(e) => mudarPosto(posto.id, (x) => ({ ...x, quantidade: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)) }))}
                  />
                  <span className="sufixo" aria-hidden>
                    postos
                  </span>
                </div>
              </div>
              {!somenteLeitura && planilha.tipos.length > 1 && (
                <button
                  type="button"
                  className="btn btn-discreto"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: `Remover o posto "${posto.nome}"?`, texto: "As linhas deste posto saem da planilha.", confirmar: "Remover", perigo: true }))) return;
                    setPlanilha((pl) => ({ tipos: pl.tipos.filter((x) => x.id !== posto.id) }));
                    setAba(planilha.tipos.find((x) => x.id !== posto.id)?.id ?? "");
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden /> Remover posto
                </button>
              )}
            </div>

            <div className="so-celular mt-16 campo">
              <label htmlFor={`mod-${posto.id}`}>Módulo</label>
              <select id={`mod-${posto.id}`} value={moduloCelular} onChange={(e) => setModuloCelular(e.target.value as ModuloId)}>
                {MODULOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-16 pilha" style={{ gap: 8 }}>
              {MODULOS.map((m) => {
                const linhas = posto.linhas.filter((l) => l.modulo === m.id);
                const vis = linhas.filter(visivel);
                if (soMudou && antes && vis.length === 0) return null;
                const chave = `${posto.id}:${m.id}`;
                const fechado = recolhidos.has(chave);
                const subtotal = calcPosto?.totaisModulo[m.id];
                return (
                  <section key={m.id} className={`modulo-planilha${m.id !== moduloCelular ? " fora-celular" : ""}`} aria-label={m.nome}>
                    <div className="modulo-cab">
                      <button
                        type="button"
                        className="modulo-toggle"
                        aria-expanded={!fechado}
                        onClick={() =>
                          setRecolhidos((r) => {
                            const n = new Set(r);
                            if (n.has(chave)) n.delete(chave);
                            else n.add(chave);
                            return n;
                          })
                        }
                      >
                        <ChevronDown size={16} strokeWidth={1.5} aria-hidden style={{ transform: fechado ? "rotate(-90deg)" : undefined, transition: "transform 120ms" }} />
                        <span>
                          {m.nome} <span className="legenda">({linhas.length})</span>
                        </span>
                      </button>
                      <span className="num" style={{ fontWeight: 600 }}>
                        {subtotal ? brl(subtotal) : "—"}
                      </span>
                    </div>
                    {!fechado && (
                      <div className="linhas-planilha" role="table" aria-label={`Linhas de ${m.nome}`}>
                        <div className="linha-planilha cab so-desktop" role="row">
                          <span role="columnheader">Item e fonte</span>
                          <span role="columnheader">Tipo</span>
                          <span role="columnheader" className="num">
                            Valor
                          </span>
                          <span role="columnheader">Base</span>
                          <span role="columnheader">
                            <span className="sr-only">Ações</span>
                          </span>
                        </div>
                        {vis.map((l) => (
                          <LinhaEditor
                            key={l.id}
                            l={l}
                            m={m.id}
                            postoId={posto.id}
                            alterou={antes ? mudou.has(`${posto.id}:${l.id}`) : false}
                            destacar={alterada === l.id}
                            valorCalculado={calcPosto?.linhas.find((x) => x.id === l.id)?.valor}
                            somenteLeitura={somenteLeitura}
                            mudarLinha={mudarLinha}
                            remover={() => mudarPosto(posto.id, (x) => ({ ...x, linhas: x.linhas.filter((y) => y.id !== l.id) }))}
                            colar={colar}
                            aoTeclar={aoTeclar}
                          />
                        ))}
                        {!somenteLeitura && (
                          <button type="button" className="btn btn-discreto btn-pequeno" style={{ justifySelf: "start", marginTop: 4 }} onClick={() => adicionarLinha(posto.id, m)}>
                            <Plus size={14} strokeWidth={1.5} aria-hidden /> Adicionar linha
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        <div aria-live="polite">
          {erros.length > 0 && (
            <div className="alerta alerta-atencao">
              <AlertTriangle size={20} strokeWidth={1.5} aria-hidden />
              <div className="alerta-corpo">
                <strong>Pendências na planilha</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {erros.slice(0, 6).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="assistente-memoria cartao" aria-label={antes ? "Memória de cálculo" : "Totais"}>
        {!antes ? (
          <>
            <h2>Totais da planilha atual</h2>
            {resultado ? (
              <dl className="dl-resumo" style={{ gridTemplateColumns: "1fr auto" }}>
                {resultado.postos.map((p) => (
                  <div key={p.id} style={{ display: "contents" }}>
                    <dt>
                      {p.nome}
                      <span className="legenda" style={{ display: "block" }}>
                        {brl(p.valorPorPosto)} × {p.quantidade}
                      </span>
                    </dt>
                    <dd className="num">{brl(p.valorMensal)}</dd>
                  </div>
                ))}
                <dt>
                  <strong>Total mensal</strong>
                </dt>
                <dd className="num" style={{ fontWeight: 600, fontSize: 18 }}>
                  {brl(resultado.valorMensal)}
                </dd>
              </dl>
            ) : (
              <p className="secundario">Os totais aparecem quando a planilha não tiver pendências.</p>
            )}
          </>
        ) : (
          <>
            <h2>Memória de cálculo</h2>
            {!comparacao || comparacao.erros.length ? (
              <p className="secundario">A memória aparece quando a planilha não tiver pendências.</p>
            ) : (
              <>
                <dl className="dl-resumo" style={{ gridTemplateColumns: "1fr auto" }}>
                  <dt>Valor mensal antes</dt>
                  <dd className="num">{brl(comparacao.mensalAntes)}</dd>
                  <dt>Valor mensal novo</dt>
                  <dd className="num">{brl(comparacao.mensalAgora)}</dd>
                  <dt>
                    <strong>Diferença por mês</strong>
                  </dt>
                  <dd className="num" style={{ fontWeight: 600 }}>
                    {brl(comparacao.diferencaMensal)} {comparacao.variacaoPct && <span className="legenda">({pct(comparacao.variacaoPct)})</span>}
                  </dd>
                  <dt>
                    <strong>Desde a data-base</strong>
                  </dt>
                  <dd className="num" style={{ fontWeight: 600 }}>
                    {retro ? brl(retro.total) : "—"}
                  </dd>
                </dl>
                <div className="mt-16">
                  <CampoData
                    nome="dataReferencia"
                    rotulo="Contar a diferença até"
                    valorInicial={dataRef}
                    mostrarRelativo={false}
                    form={formReferencia}
                    aoMudar={(iso) => iso && setDataRef(iso)}
                    ajuda="Normalmente, hoje ou a data do protocolo."
                  />
                </div>
                {!dataBase && <p className="ajuda-texto">Informe a data-base no passo 1 para calcular a diferença acumulada.</p>}
                <hr className="regua" style={{ margin: "12px 0" }} />
                <h3 style={{ fontSize: 15 }}>O que mudou</h3>
                <ul className="lista-limpa pilha-8" style={{ font: "var(--t-ajuda)" }}>
                  {comparacao.linhas
                    .filter((l) => l.variacao !== "0.00")
                    .map((l) => (
                      <li key={`${l.postoId}-${l.id}`} className={alterada === l.id ? "alterada" : undefined}>
                        <strong style={{ fontWeight: 500 }}>{l.descricao}</strong>
                        {comparacao.postos.length > 1 && <span className="legenda"> · {l.postoNome}</span>}
                        <span className="comparacao" style={{ display: "flex" }}>
                          {brl(l.antes)} → {brl(l.agora)}
                          <span className={Number(l.variacao) < 0 ? "delta-menos" : "delta-mais"}>
                            {Number(l.variacao) > 0 ? "+" : ""}
                            {brl(l.variacao)}
                          </span>
                        </span>
                        <span className="legenda" style={{ display: "block" }}>
                          {l.contaAgora}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function LinhaEditor({
  l,
  m,
  postoId,
  alterou,
  destacar,
  valorCalculado,
  somenteLeitura,
  mudarLinha,
  remover,
  colar,
  aoTeclar,
}: {
  l: LinhaPlanilha;
  m: ModuloId;
  postoId: string;
  alterou: boolean;
  destacar: boolean;
  valorCalculado?: string;
  somenteLeitura?: boolean;
  mudarLinha: (pid: string, lid: string, patch: Partial<LinhaPlanilha>) => void;
  remover: () => void;
  colar: (pid: string, lid: string, texto: string) => boolean;
  aoTeclar: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const semFonte = alterou && !l.fonte?.trim();
  return (
    <div role="row" className={`linha-planilha${destacar ? " alterada" : ""}${alterou ? " mudou" : ""}`}>
      <span role="cell" className="c-item">
        <label className="sr-only" htmlFor={`d-${l.id}`}>
          Descrição
        </label>
        <input id={`d-${l.id}`} data-col="d" value={l.descricao} placeholder="Descrição" disabled={somenteLeitura} onKeyDown={aoTeclar} onChange={(e) => mudarLinha(postoId, l.id, { descricao: e.target.value })} />
        <label className="sr-only" htmlFor={`f-${l.id}`}>
          Fonte de {l.descricao}
        </label>
        <input
          id={`f-${l.id}`}
          data-col="f"
          className={`fonte${semFonte ? " falta" : ""}`}
          value={l.fonte ?? ""}
          placeholder={semFonte ? "Fonte obrigatória: cláusula da convenção" : "Fonte: ex.: CCT 2026, cl. 4ª"}
          aria-invalid={semFonte}
          disabled={somenteLeitura}
          onKeyDown={aoTeclar}
          onChange={(e) => mudarLinha(postoId, l.id, { fonte: e.target.value || undefined })}
        />
        {(m === "M1" && l.tipo === "VALOR") || semFonte ? (
          <span className="fileira" style={{ gap: 8 }}>
            {m === "M1" && l.tipo === "VALOR" && (
              <label className="check legenda">
                <input type="radio" name={`sb-${postoId}`} checked={!!l.salarioBase} disabled={somenteLeitura} onChange={() => mudarLinha(postoId, l.id, { salarioBase: true })} /> É o salário base
              </label>
            )}
            {semFonte && (
              <span className="selo selo-ambar" style={{ fontSize: 12, padding: "0 6px" }}>
                falta fonte
              </span>
            )}
          </span>
        ) : null}
      </span>
      <span role="cell">
        <label className="sr-only" htmlFor={`t-${l.id}`}>
          Tipo de {l.descricao}
        </label>
        {m === "M6_TRIBUTOS" ? (
          <span className="legenda">%</span>
        ) : (
          <select
            id={`t-${l.id}`}
            data-col="t"
            value={l.tipo}
            disabled={somenteLeitura || !!l.salarioBase}
            onKeyDown={aoTeclar}
            onChange={(e) =>
              mudarLinha(postoId, l.id, {
                tipo: e.target.value as LinhaPlanilha["tipo"],
                base: e.target.value === "PERCENTUAL" ? l.base ?? BASES_PERMITIDAS[m][BASES_PERMITIDAS[m].length - 1] : undefined,
              })
            }
          >
            <option value="VALOR">R$</option>
            <option value="PERCENTUAL">%</option>
          </select>
        )}
      </span>
      <span role="cell" className="c-valor">
        <label className="sr-only" htmlFor={`v-${l.id}`}>
          Valor {l.tipo === "PERCENTUAL" ? "em %" : "em R$"} de {l.descricao}
        </label>
        <input
          id={`v-${l.id}`}
          data-col="v"
          className="valor-num"
          inputMode="decimal"
          value={exibir(l.valor)}
          disabled={somenteLeitura}
          aria-invalid={!valido(l.valor)}
          onKeyDown={aoTeclar}
          onPaste={(e) => {
            if (colar(postoId, l.id, e.clipboardData.getData("text"))) e.preventDefault();
          }}
          onChange={(e) => mudarLinha(postoId, l.id, { valor: normalizar(e.target.value) })}
        />
        {valorCalculado && l.tipo === "PERCENTUAL" && (
          <span className="legenda num" style={{ display: "block" }}>
            {brl(valorCalculado)}
          </span>
        )}
      </span>
      <span role="cell">
        {l.tipo === "PERCENTUAL" && m !== "M6_TRIBUTOS" ? (
          <>
            <label className="sr-only" htmlFor={`b-${l.id}`}>
              Base do percentual de {l.descricao}
            </label>
            <select id={`b-${l.id}`} data-col="b" value={l.base ?? ""} disabled={somenteLeitura} onKeyDown={aoTeclar} onChange={(e) => mudarLinha(postoId, l.id, { base: e.target.value as BaseId })}>
              {BASES_PERMITIDAS[m].map((b) => (
                <option key={b} value={b}>
                  {NOME_BASE[b]}
                </option>
              ))}
            </select>
          </>
        ) : m === "M6_TRIBUTOS" ? (
          <span className="legenda">por dentro</span>
        ) : (
          <span className="legenda">—</span>
        )}
      </span>
      <span role="cell">
        {!somenteLeitura && !l.salarioBase && (
          <button type="button" className="btn btn-discreto btn-pequeno btn-icone" aria-label={`Remover ${l.descricao || "linha"}`} onClick={remover}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        )}
      </span>
    </div>
  );
}
