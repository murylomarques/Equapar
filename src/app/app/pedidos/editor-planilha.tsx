"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { brl, calcularPlanilha, calcularRetroativo, compararPlanilhas, pct, validarPlanilha } from "@/lib/calculo/motor";
import { BASES_PERMITIDAS, MODULOS, NOME_BASE, type BaseId, type LinhaPlanilha, type ModuloId, type PlanilhaCustos } from "@/lib/calculo/tipos";
import { novoId, postoModelo } from "@/lib/calculo/modelo";
import { salvarPlanilha } from "./acoes";

/** "1.820,00" -> "1820.00"; "8,33" -> "8.33"; "1.820" -> "1820" */
function normalizar(v: string) {
  let s = v.replace(/\s|R\$|%/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return s;
}
function exibir(v: string) {
  return v.replace(".", ",");
}

export function EditorPlanilha({
  pedidoId,
  qual,
  inicial,
  antes,
  dataBase,
  dataReferenciaInicial,
  somenteLeitura,
}: {
  pedidoId: string;
  qual: "antes" | "agora";
  inicial: PlanilhaCustos;
  antes?: PlanilhaCustos;
  dataBase?: string | null;
  dataReferenciaInicial?: string;
  somenteLeitura?: boolean;
}) {
  const [planilha, setPlanilha] = useState<PlanilhaCustos>(inicial);
  const [salvo, setSalvo] = useState<string>("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [, iniciar] = useTransition();
  const [alterada, setAlterada] = useState<string | null>(null);
  const [dataRef, setDataRef] = useState(dataReferenciaInicial ?? new Date().toISOString().slice(0, 10));
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (somenteLeitura) return;
    const t = setTimeout(() => {
      iniciar(async () => {
        const r = await salvarPlanilha(pedidoId, qual, JSON.stringify(planilha));
        if (r.erro) setErroSalvar(r.erro);
        else {
          setErroSalvar("");
          setSalvo(r.ok ?? "");
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [planilha, pedidoId, qual, somenteLeitura]);

  const erros = useMemo(() => validarPlanilha(planilha), [planilha]);
  const resultado = useMemo(() => (erros.length ? null : calcularPlanilha(planilha)), [planilha, erros]);
  const comparacao = useMemo(() => (antes && !erros.length ? compararPlanilhas(antes, planilha) : null), [antes, planilha, erros]);
  const retro = useMemo(() => {
    if (!comparacao || comparacao.erros.length || !dataBase || !dataRef) return null;
    return calcularRetroativo(comparacao.diferencaMensal, new Date(`${dataBase}T00:00:00Z`), new Date(`${dataRef}T00:00:00Z`));
  }, [comparacao, dataBase, dataRef]);

  const mudarPosto = (pid: string, f: (p: PlanilhaCustos["tipos"][number]) => PlanilhaCustos["tipos"][number]) =>
    setPlanilha((pl) => ({ tipos: pl.tipos.map((t) => (t.id === pid ? f(t) : t)) }));
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

  return (
    <div className={antes ? "assistente" : ""}>
      <div className="pilha">
        {planilha.tipos.map((t) => (
          <div key={t.id} className="cartao" style={{ padding: 16 }}>
            <div className="linha-form" style={{ marginBottom: 12, gridTemplateColumns: "2fr 1fr auto", alignItems: "end" }}>
              <div className="campo mb-0">
                <label htmlFor={`nome-${t.id}`}>Tipo de posto</label>
                <input id={`nome-${t.id}`} value={t.nome} disabled={somenteLeitura} onChange={(e) => mudarPosto(t.id, (x) => ({ ...x, nome: e.target.value }))} />
              </div>
              <div className="campo mb-0">
                <label htmlFor={`qtd-${t.id}`}>Quantidade de postos</label>
                <input
                  id={`qtd-${t.id}`}
                  type="number"
                  min={0}
                  value={t.quantidade}
                  disabled={somenteLeitura}
                  onChange={(e) => mudarPosto(t.id, (x) => ({ ...x, quantidade: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                />
              </div>
              {!somenteLeitura && planilha.tipos.length > 1 && (
                <button
                  type="button"
                  className="btn btn-texto"
                  onClick={() => window.confirm(`Remover o posto "${t.nome}"?`) && setPlanilha((pl) => ({ tipos: pl.tipos.filter((x) => x.id !== t.id) }))}
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden /> Remover posto
                </button>
              )}
            </div>
            <div className="tabela-rolagem">
              <table className="tabela editor-linhas">
                <thead>
                  <tr>
                    <th scope="col">Item e fonte (cláusula, página)</th>
                    <th scope="col">Tipo</th>
                    <th scope="col" className="num">
                      Valor
                    </th>
                    <th scope="col">Base</th>
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MODULOS.map((m) => {
                    const linhas = t.linhas.filter((l) => l.modulo === m.id);
                    return (
                      <FragModulo
                        key={m.id}
                        modulo={m.id}
                        nome={m.nome}
                        linhas={linhas}
                        somenteLeitura={somenteLeitura}
                        alterada={alterada}
                        onMudar={(lid, patch) => mudarLinha(t.id, lid, patch)}
                        onRemover={(lid) => mudarPosto(t.id, (x) => ({ ...x, linhas: x.linhas.filter((l) => l.id !== lid) }))}
                        onAdicionar={() =>
                          mudarPosto(t.id, (x) => {
                            const nova: LinhaPlanilha = {
                              id: novoId(),
                              modulo: m.id,
                              descricao: "",
                              tipo: m.id === "M6_TRIBUTOS" || m.basePadrao === "M1" ? "PERCENTUAL" : "VALOR",
                              base: m.basePadrao,
                              valor: "0",
                            };
                            const idx = x.linhas.map((l) => l.modulo).lastIndexOf(m.id);
                            const linhasN = [...x.linhas];
                            if (idx >= 0) linhasN.splice(idx + 1, 0, nova);
                            else {
                              const ordem = MODULOS.findIndex((mm) => mm.id === m.id);
                              const pos = linhasN.findIndex((l) => MODULOS.findIndex((mm) => mm.id === l.modulo) > ordem);
                              linhasN.splice(pos < 0 ? linhasN.length : pos, 0, nova);
                            }
                            return { ...x, linhas: linhasN };
                          })
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            {resultado && (
              <p className="mt-16 mb-0" style={{ fontSize: 14 }}>
                Por posto: <strong className="num">{brl(resultado.postos.find((p) => p.id === t.id)?.valorPorPosto ?? "0")}</strong> · Mensal ({t.quantidade} postos):{" "}
                <strong className="num">{brl(resultado.postos.find((p) => p.id === t.id)?.valorMensal ?? "0")}</strong>
              </p>
            )}
          </div>
        ))}
        {!somenteLeitura && (
          <button type="button" className="btn" onClick={() => setPlanilha((pl) => ({ tipos: [...pl.tipos, postoModelo(`Posto ${pl.tipos.length + 1}`)] }))}>
            <Plus size={16} strokeWidth={1.5} aria-hidden /> Adicionar tipo de posto
          </button>
        )}
        <div aria-live="polite">
          {erros.length > 0 && (
            <div className="aviso-caixa">
              <strong>Pendências na planilha</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {erros.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {erroSalvar && <p className="erro-texto">{erroSalvar}</p>}
          {salvo && !erroSalvar && (
            <p key={salvo} className="salvo">
              {salvo}
            </p>
          )}
        </div>
        {!antes && resultado && (
          <p style={{ fontSize: 15 }}>
            Valor mensal da planilha atual: <strong className="num">{brl(resultado.valorMensal)}</strong>
          </p>
        )}
      </div>

      {antes && (
        <aside className="assistente-memoria cartao" aria-label="Memória de cálculo">
          <h2>Memória de cálculo</h2>
          {!comparacao || comparacao.erros.length ? (
            <p className="secundario">A memória aparece quando a planilha não tiver pendências.</p>
          ) : (
            <>
              <table className="tabela" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Antes</th>
                    <th className="num">Agora</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.linhas
                    .filter((l) => l.variacao !== "0.00")
                    .map((l) => (
                      <tr key={`${l.postoId}-${l.id}`} className={alterada === l.id ? "alterada" : undefined}>
                        <td>
                          {l.descricao}
                          {comparacao.postos.length > 1 && <div className="legenda">{l.postoNome}</div>}
                          <div className="legenda">{l.contaAgora}</div>
                          {l.fonte && <div className="legenda">Fonte: {l.fonte}</div>}
                        </td>
                        <td className="num">{brl(l.antes)}</td>
                        <td className="num">{brl(l.agora)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {comparacao.linhas.every((l) => l.variacao === "0.00") && <p className="secundario">Nenhuma linha mudou ainda. Atualize pisos, benefícios e encargos da convenção nova.</p>}
              <hr className="regua" style={{ margin: "16px 0" }} />
              <dl className="dl-resumo">
                <dt>Valor mensal antes</dt>
                <dd className="num" style={{ textAlign: "left" }}>
                  {brl(comparacao.mensalAntes)}
                </dd>
                <dt>Valor mensal novo</dt>
                <dd className="num" style={{ textAlign: "left" }}>
                  {brl(comparacao.mensalAgora)}
                </dd>
                <dt>Diferença por mês</dt>
                <dd className="num" style={{ textAlign: "left", fontWeight: 600 }}>
                  {brl(comparacao.diferencaMensal)} {comparacao.variacaoPct && <span className="legenda">({pct(comparacao.variacaoPct)})</span>}
                </dd>
                <dt>
                  <label htmlFor="dataReferencia">Contar diferença até</label>
                </dt>
                <dd>
                  <input id="dataReferencia" name="dataReferencia" form="form-passo3" type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} style={{ maxWidth: 180 }} />
                </dd>
                <dt>Desde a data-base</dt>
                <dd className="num" style={{ textAlign: "left", fontWeight: 600 }}>
                  {retro ? brl(retro.total) : "informe a data-base no passo 1"}
                </dd>
              </dl>
              {retro && retro.meses.length > 0 && (
                <details className="mt-16">
                  <summary className="legenda" style={{ cursor: "pointer" }}>
                    Mês a mês ({retro.meses.length})
                  </summary>
                  <ul className="lista-limpa legenda" style={{ marginTop: 8 }}>
                    {retro.meses.map((m) => (
                      <li key={m.competencia}>
                        {m.competencia}: {m.conta}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function FragModulo({
  modulo,
  nome,
  linhas,
  somenteLeitura,
  alterada,
  onMudar,
  onRemover,
  onAdicionar,
}: {
  modulo: ModuloId;
  nome: string;
  linhas: LinhaPlanilha[];
  somenteLeitura?: boolean;
  alterada: string | null;
  onMudar: (lid: string, patch: Partial<LinhaPlanilha>) => void;
  onRemover: (lid: string) => void;
  onAdicionar: () => void;
}) {
  const bases = BASES_PERMITIDAS[modulo];
  return (
    <>
      <tr className="modulo">
        <td colSpan={5}>
          <div className="entre">
            {nome}
            {!somenteLeitura && (
              <button type="button" className="btn btn-texto btn-pequeno" onClick={onAdicionar} aria-label={`Adicionar linha em ${nome}`}>
                <Plus size={14} strokeWidth={1.5} aria-hidden /> Linha
              </button>
            )}
          </div>
        </td>
      </tr>
      {linhas.map((l) => (
        <tr key={l.id} className={alterada === l.id ? "alterada" : undefined}>
          <td style={{ minWidth: 200, width: "100%" }}>
            <label className="sr-only" htmlFor={`d-${l.id}`}>
              Descrição
            </label>
            <input id={`d-${l.id}`} value={l.descricao} disabled={somenteLeitura} onChange={(e) => onMudar(l.id, { descricao: e.target.value })} />
            <label className="sr-only" htmlFor={`f-${l.id}`}>
              Fonte
            </label>
            <input
              id={`f-${l.id}`}
              className="fonte"
              value={l.fonte ?? ""}
              placeholder="Fonte: ex.: CCT 2026, cl. 4ª"
              disabled={somenteLeitura}
              onChange={(e) => onMudar(l.id, { fonte: e.target.value || undefined })}
            />
            {modulo === "M1" && l.tipo === "VALOR" && (
              <label className="check legenda" style={{ marginTop: 4 }}>
                <input type="radio" checked={!!l.salarioBase} disabled={somenteLeitura} onChange={() => onMudar(l.id, { salarioBase: true })} /> É o salário base
              </label>
            )}
          </td>
          <td>
            <label className="sr-only" htmlFor={`t-${l.id}`}>
              Tipo
            </label>
            {modulo === "M6_TRIBUTOS" ? (
              <span className="legenda">%</span>
            ) : (
              <select
                id={`t-${l.id}`}
                value={l.tipo}
                disabled={somenteLeitura || !!l.salarioBase}
                onChange={(e) => onMudar(l.id, { tipo: e.target.value as LinhaPlanilha["tipo"], base: e.target.value === "PERCENTUAL" ? l.base ?? bases[bases.length - 1] : undefined })}
                style={{ width: 70 }}
              >
                <option value="VALOR">R$</option>
                <option value="PERCENTUAL">%</option>
              </select>
            )}
          </td>
          <td className="num">
            <label className="sr-only" htmlFor={`v-${l.id}`}>
              Valor
            </label>
            <input
              id={`v-${l.id}`}
              className="valor"
              inputMode="decimal"
              value={exibir(l.valor)}
              disabled={somenteLeitura}
              aria-invalid={!/^-?\d+(\.\d+)?$/.test(l.valor)}
              onChange={(e) => onMudar(l.id, { valor: normalizar(e.target.value) })}
            />
          </td>
          <td>
            {l.tipo === "PERCENTUAL" && modulo !== "M6_TRIBUTOS" ? (
              <>
                <label className="sr-only" htmlFor={`b-${l.id}`}>
                  Base do percentual
                </label>
                <select id={`b-${l.id}`} value={l.base ?? ""} disabled={somenteLeitura} onChange={(e) => onMudar(l.id, { base: e.target.value as BaseId })} style={{ minWidth: 0, width: 130 }}>
                  {bases.map((b) => (
                    <option key={b} value={b}>
                      {NOME_BASE[b]}
                    </option>
                  ))}
                </select>
              </>
            ) : modulo === "M6_TRIBUTOS" ? (
              <span className="legenda">por dentro</span>
            ) : (
              <span className="legenda">—</span>
            )}
          </td>
          <td>
            {!somenteLeitura && !l.salarioBase && (
              <button type="button" className="icone-botao" aria-label={`Remover ${l.descricao || "linha"}`} onClick={() => onRemover(l.id)}>
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
