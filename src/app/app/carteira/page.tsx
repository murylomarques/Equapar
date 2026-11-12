import type { Metadata } from "next";
import Link from "next/link";
import { contexto, pode } from "@/lib/auth";
import { contratosDoContexto } from "@/lib/consultas";
import { oportunidade, proximoPrazo, seloSituacao } from "@/lib/prazos";
import { data, diasAte, MESES, reais } from "@/lib/format";
import { Selo } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { importarPncp } from "../acoes";
import { iniciarPedidosEmLote } from "../pedidos/acoes";

export const metadata: Metadata = { title: "Carteira | Equapar" };

const FILTROS = [
  { id: "prazo60", nome: "Prazo em 60 dias" },
  { id: "semconvencao", nome: "Sem convenção informada" },
  { id: "pedido", nome: "Pedido em andamento" },
] as const;

const ESFERAS: Record<string, string> = { F: "Federal", E: "Estadual", M: "Municipal", D: "Distrital" };

export default async function Carteira({ searchParams }: { searchParams: Promise<{ filtro?: string; uf?: string; esfera?: string }> }) {
  const ctx = await contexto();
  const sp = await searchParams;
  const todos = await contratosDoContexto(ctx);
  const ufs = [...new Set(todos.map((c) => c.uf).filter(Boolean))].sort() as string[];
  const esferas = [...new Set(todos.map((c) => c.esfera).filter(Boolean))] as string[];

  let contratos = todos;
  if (sp.filtro === "prazo60") contratos = contratos.filter((c) => {
    const p = proximoPrazo(c);
    return p && diasAte(p.data) <= 60;
  });
  if (sp.filtro === "semconvencao") contratos = contratos.filter((c) => c.maoDeObraDedicada && c.tipoReajuste === "REPACTUACAO" && !c.convencao);
  if (sp.filtro === "pedido") contratos = contratos.filter((c) => c.pedidos.some((p) => !["RECEBIDO", "INDEFERIDO"].includes(p.estado)));
  if (sp.uf) contratos = contratos.filter((c) => c.uf === sp.uf);
  if (sp.esfera) contratos = contratos.filter((c) => c.esfera === sp.esfera);
  contratos = [...contratos].sort((a, b) => (proximoPrazo(a)?.data.getTime() ?? Infinity) - (proximoPrazo(b)?.data.getTime() ?? Infinity));

  // Ação em lote: contratos da mesma convenção com repactuação a pedir e sem pedido aberto
  const lotes = new Map<string, { nome: string; ids: string[] }>();
  for (const c of todos) {
    const op = oportunidade(c);
    if (op && !op.pedidoAberto && c.convencao) {
      const l = lotes.get(c.convencao.id) ?? { nome: c.convencao.nome, ids: [] };
      l.ids.push(c.id);
      lotes.set(c.convencao.id, l);
    }
  }
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/app/carteira${s ? `?${s}` : ""}`;
  };
  const podeEditar = pode(ctx.papel, "editar_contratos");

  return (
    <>
      <div className="app-cab">
        <div>
          <h1>Carteira</h1>
          <p className="secundario mb-0">
            {todos.length} {todos.length === 1 ? "contrato" : "contratos"}
            {ctx.conta.tipo === "ASSESSORIA" && !ctx.empresaId ? " de todos os clientes" : ""}
          </p>
        </div>
        {podeEditar && (
          <div className="fileira">
            {ctx.empresaId && (
              <FormAcao action={importarPncp}>
                <input type="hidden" name="empresaId" value={ctx.empresaId} />
                <BotaoEnvio className="btn" pendente="Consultando o PNCP…">
                  Atualizar do PNCP
                </BotaoEnvio>
              </FormAcao>
            )}
            <Link href="/app/contratos/novo" className="btn btn-primario">
              Cadastrar contrato
            </Link>
          </div>
        )}
      </div>

      {[...lotes.entries()]
        .filter(([, l]) => l.ids.length > 1)
        .map(([id, l]) => (
          <div key={id} className="aviso-caixa entre" style={{ marginBottom: 16 }}>
            <span>
              {l.ids.length} contratos da {l.nome} têm repactuação a pedir.
            </span>
            {pode(ctx.papel, "editar_pedidos") && (
              <FormAcao action={iniciarPedidosEmLote}>
                {l.ids.map((i) => (
                  <input key={i} type="hidden" name="contratoId" value={i} />
                ))}
                <BotaoEnvio className="btn btn-pequeno">Montar pedidos para os {l.ids.length} contratos desta convenção</BotaoEnvio>
              </FormAcao>
            )}
          </div>
        ))}

      <nav className="filtros" aria-label="Filtros rápidos">
        <Link href={link({ filtro: undefined })} className="filtro" aria-current={!sp.filtro ? "true" : undefined}>
          Todos
        </Link>
        {FILTROS.map((f) => (
          <Link key={f.id} href={link({ filtro: f.id })} className="filtro" aria-current={sp.filtro === f.id ? "true" : undefined}>
            {f.nome}
          </Link>
        ))}
        {ufs.map((u) => (
          <Link key={u} href={link({ uf: sp.uf === u ? undefined : u })} className="filtro" aria-current={sp.uf === u ? "true" : undefined}>
            {u}
          </Link>
        ))}
        {esferas.map((e) => (
          <Link key={e} href={link({ esfera: sp.esfera === e ? undefined : e })} className="filtro" aria-current={sp.esfera === e ? "true" : undefined}>
            {ESFERAS[e] ?? e}
          </Link>
        ))}
      </nav>

      {contratos.length === 0 ? (
        <div className="cartao vazio">
          {todos.length === 0 ? (
            <>
              <p>Nenhum contrato ainda. Importe do PNCP pelo CNPJ ou cadastre à mão.</p>
              <Link href="/app/boas-vindas" className="btn btn-primario">
                Importar do PNCP
              </Link>
            </>
          ) : (
            <p>Nenhum contrato com este filtro.</p>
          )}
        </div>
      ) : (
        <>
          <div className="tabela-rolagem so-desktop">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Órgão</th>
                  <th scope="col" className="num">
                    Postos
                  </th>
                  <th scope="col" className="num">
                    Valor mensal
                  </th>
                  <th scope="col">Convenção (data-base)</th>
                  <th scope="col" className="num">
                    Fim da vigência
                  </th>
                  <th scope="col">Próximo prazo</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => {
                  const pp = proximoPrazo(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link className="linha-link" href={`/app/contratos/${c.id}`}>
                          {c.numero}
                        </Link>
                        {ctx.conta.tipo === "ASSESSORIA" && !ctx.empresaId && <div className="legenda">{c.empresa.razaoSocial}</div>}
                      </td>
                      <td>
                        {c.orgao}
                        <div className="legenda">{[c.municipio, c.uf].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="num">{c.postos ?? "—"}</td>
                      <td className="num">{c.valorMensal ? reais(c.valorMensal) : "—"}</td>
                      <td>{c.convencao ? `${c.convencao.nome.slice(0, 40)} (${MESES[c.convencao.mesDataBase - 1]})` : <span className="secundario">—</span>}</td>
                      <td className="num">{data(c.vigenciaFim)}</td>
                      <td>
                        {pp ? (
                          <>
                            {data(pp.data)}
                            <div className="legenda">{pp.titulo}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Selo selo={seloSituacao(c)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="cartoes-celular">
            {contratos.map((c) => (
              <Link key={c.id} href={`/app/contratos/${c.id}`} className="cartao-linha">
                <strong>{c.orgao}</strong>
                <span className="legenda">
                  Contrato {c.numero} · fim da vigência {data(c.vigenciaFim)}
                </span>
                <div style={{ marginTop: 6 }}>
                  <Selo selo={seloSituacao(c)} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
