"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Layers } from "lucide-react";
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
  selo: TSelo;
  pedir: boolean; // repactuação a pedir, sem pedido aberto
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

  const Cab = ({ col, children, num }: { col: Coluna; children: React.ReactNode; num?: boolean }) => {
    const ativa = ordem.col === col;
    return (
      <th scope="col" className={num ? "num" : undefined} aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}>
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
      <div className="tabela-rolagem so-desktop">
        <table className="tabela">
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
              <Cab col="numero">Contrato</Cab>
              <Cab col="orgao">Órgão</Cab>
              <Cab col="postos" num>
                Postos
              </Cab>
              <Cab col="valorMensal" num>
                Valor mensal
              </Cab>
              <Cab col="convencao">Convenção</Cab>
              <Cab col="fim" num>
                Fim da vigência
              </Cab>
              <Cab col="prazoData">Próximo prazo</Cab>
              <th scope="col">Situação</th>
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
                <td>
                  <Link className="linha-link" href={`/app/contratos/${l.id}`}>
                    {l.numero}
                  </Link>
                  {mostrarEmpresa && <div className="legenda">{l.empresa}</div>}
                </td>
                <td>
                  {l.orgao}
                  <div className="legenda">{l.local}</div>
                </td>
                <td className="num">{l.postos ?? "—"}</td>
                <td className="num">{l.valorMensalTxt}</td>
                <td style={{ maxWidth: 220 }}>{l.convencao ?? <span className="secundario">—</span>}</td>
                <td className="num">{l.fimTxt}</td>
                <td>
                  {l.prazoTxt}
                  <div className="legenda">{l.prazoTitulo}</div>
                </td>
                <td>
                  <Selo selo={l.selo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cartoes-celular">
        {ordenadas.map((l) => (
          <Link key={l.id} href={`/app/contratos/${l.id}`} className="cartao-linha">
            <strong>{l.orgao}</strong>
            <span className="legenda">
              Contrato {l.numero} · fim da vigência {l.fimTxt}
            </span>
            <div style={{ marginTop: 8 }}>
              <Selo selo={l.selo} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
