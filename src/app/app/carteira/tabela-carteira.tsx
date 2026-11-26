"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Layers } from "lucide-react";
import { Selo } from "@/components/selo";
import type { Selo as TSelo } from "@/lib/prazos";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { plural } from "@/lib/mascaras";
import { iniciarPedidosEmLote } from "../pedidos/acoes";

export interface LinhaCarteira {
  id: string;
  numero: string;
  empresa: string;
  orgao: string;
  local: string;
  postos: number | null;
  valorMensal: number | null;
  valorMensalTxt: string;
  convencaoId: string | null;
  convencao: string | null;
  fim: string; // ISO
  fimTxt: string;
  prazoData: string | null;
  prazoTxt: string;
  prazoTitulo: string;
  prazoCurto: string;
  selo: TSelo;
  pedir: boolean; // repactuação a pedir, sem pedido aberto
  ressalvar: boolean; // a pedir, mas a convenção nova ainda não foi registrada: ressalvar no aditivo
}

/** Botão da linha: só quem monta pedidos vê "Montar pedido" (papel Leitura, ou conta só para consulta, vê "Abrir"). */
function acaoDaLinha(l: LinhaCarteira, podePedir: boolean) {
  if (podePedir && l.ressalvar) return { texto: "Ver o que fazer", href: `/app/contratos/${l.id}/prorrogacao` };
  if (podePedir && l.pedir) return { texto: "Montar pedido", href: `/app/pedidos/novo?contrato=${l.id}` };
  return { texto: "Abrir", href: `/app/contratos/${l.id}` };
}

type Coluna = "numero" | "orgao" | "postos" | "valorMensal" | "convencao" | "fim" | "prazoData";

export function TabelaCarteira({ linhas, mostrarEmpresa, podeLote }: { linhas: LinhaCarteira[]; mostrarEmpresa: boolean; podeLote: boolean }) {
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: "prazoData", asc: true });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const ordenadas = useMemo(() => {
    const v = (l: LinhaCarteira) => l[ordem.col] ?? (ordem.asc ? "￿" : "");
    return [...linhas].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return ordem.asc ? r : -r;
    });
  }, [linhas, ordem]);

  const selecionadas = linhas.filter((l) => sel.has(l.id));
  const convencoesSel = new Set(selecionadas.map((l) => l.convencaoId));
  const lote = selecionadas.length > 1 && convencoesSel.size === 1 && !convencoesSel.has(null) && selecionadas.every((l) => l.pedir);
  const todos = sel.size === linhas.length && linhas.length > 0;

  const cab = (col: Coluna, children: React.ReactNode, num?: boolean) => {
    const ativa = ordem.col === col;
    return (
      <th key={col} scope="col" className={num ? "num" : undefined} aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}>
        <button type="button" className="ordenar" onClick={() => setOrdem({ col, asc: ativa ? !ordem.asc : true })}>
          {children}
          {ativa ? ordem.asc ? <ArrowUp size={14} strokeWidth={1.5} aria-hidden /> : <ArrowDown size={14} strokeWidth={1.5} aria-hidden /> : <ArrowUpDown size={14} strokeWidth={1.5} aria-hidden style={{ opacity: 0.4 }} />}
        </button>
      </th>
    );
  };

  return (
    <>
      {podeLote && selecionadas.length > 0 && (
        <div className="barra-selecao" role="region" aria-label="Ações para os contratos selecionados">
          <span>{plural(selecionadas.length, "contrato selecionado", "contratos selecionados")}</span>
          {lote ? (
            <FormAcao action={iniciarPedidosEmLote}>
              {selecionadas.map((l) => (
                <input key={l.id} type="hidden" name="contratoId" value={l.id} />
              ))}
              <BotaoEnvio className="btn btn-primario btn-pequeno" pendente="Montando os pedidos…">
                <Layers size={16} strokeWidth={1.5} aria-hidden /> Montar pedidos para os {selecionadas.length} contratos desta convenção
              </BotaoEnvio>
            </FormAcao>
          ) : (
            <span className="ajuda-texto">Para montar em lote, selecione contratos da mesma convenção com repactuação a pedir.</span>
          )}
          <button type="button" className="btn btn-discreto btn-pequeno" onClick={() => setSel(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}
      {/* 5.2: cinco colunas, sem quebrar órgão e convenção em várias linhas; cabeçalho fixo; linha inteira clicável */}
      <div className="tabela-rolagem carteira-larga cab-fixo">
        {/* A1: largura fixa por coluna; cabe em 1.150 px sem rolagem lateral. Abaixo de 1.024 px, cartões. */}
        <table className="tabela tabela-carteira">
          <colgroup>
            {podeLote && <col style={{ width: 44 }} />}
            <col />
            <col style={{ width: 170 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <caption className="sr-only">Contratos da carteira. Clique no cabeçalho para ordenar.</caption>
          <thead>
            <tr>
              {podeLote && (
                <th scope="col" style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={todos}
                    onChange={() => setSel(todos ? new Set() : new Set(linhas.map((l) => l.id)))}
                  />
                </th>
              )}
              {cab("orgao", "Contrato e órgão")}
              {cab("prazoData", "Próximo prazo")}
              <th scope="col">Situação</th>
              {cab("valorMensal", "Valor mensal", true)}
              <th scope="col">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.id} className={`linha-clicavel${sel.has(l.id) ? " selecionada" : ""}`}>
                {podeLote && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar o contrato ${l.numero}`}
                      checked={sel.has(l.id)}
                      onChange={() =>
                        setSel((s) => {
                          const n = new Set(s);
                          if (n.has(l.id)) n.delete(l.id);
                          else n.add(l.id);
                          return n;
                        })
                      }
                    />
                  </td>
                )}
                <td className="col-contrato">
                  <Link className="linha-link" href={`/app/contratos/${l.id}`}>
                    Contrato {l.numero}
                  </Link>
                  <div className="uma-linha" title={l.orgao}>
                    {l.orgao}
                  </div>
                  <div className="legenda uma-linha">
                    {[mostrarEmpresa ? l.empresa : null, l.local, `fim ${l.fimTxt}`, l.postos ? plural(l.postos, "posto", "postos") : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="legenda uma-linha" title={l.convencao ?? undefined}>
                    {l.convencao ? `Convenção: ${l.convencao}` : "Sem convenção informada"}
                  </div>
                </td>
                <td>
                  {l.prazoTxt}
                  <div className="legenda" title={l.prazoTitulo}>
                    {l.prazoCurto}
                  </div>
                </td>
                <td>
                  <Selo selo={l.selo} />
                </td>
                <td className="num">{l.valorMensalTxt}</td>
                <td>
                  <Link className="btn btn-pequeno acima" href={acaoDaLinha(l, podeLote).href}>
                    {acaoDaLinha(l, podeLote).texto}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cartoes-celular cartoes-carteira">
        {ordenadas.map((l) => (
          <Link key={l.id} href={`/app/contratos/${l.id}`} className="cartao-linha cartao-contrato">
            <span className="cartao-contrato-corpo">
              <strong>Contrato {l.numero}</strong>
              <span className="uma-linha" style={{ display: "block" }}>
                {l.orgao}
              </span>
              <span className="legenda" style={{ display: "block" }}>
                Próximo prazo: {l.prazoTxt} · fim {l.fimTxt}
              </span>
              <span className="legenda" style={{ display: "block" }}>
                Valor mensal: {l.valorMensalTxt}
              </span>
              <span style={{ display: "block", marginTop: 8 }}>
                <Selo selo={l.selo} />
              </span>
            </span>
            <ChevronRight size={20} strokeWidth={1.5} aria-hidden className="cartao-contrato-seta" />
          </Link>
        ))}
      </div>
    </>
  );
}
