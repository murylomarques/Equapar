import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { data, dataHora, diasAte, emDias, MESES, reais, dataLocal } from "@/lib/format";
import { oportunidade, prazosDoContrato, seloSituacao } from "@/lib/prazos";
import { NOME_ESTADO } from "@/lib/pedido";
import { Selo, SeloSimples } from "@/components/selo";
import { FonteRegra } from "@/components/fonte-regra";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FormContrato } from "../form-contrato";
import { arquivarContrato, editarContrato, enviarDocumentoContrato } from "../../acoes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await db.contrato.findUnique({ where: { id }, select: { numero: true } });
  return { title: c ? `Contrato ${c.numero} | Equapar` : "Contrato | Equapar" };
}

const ABAS = [
  ["resumo", "Resumo"],
  ["prazos", "Prazos"],
  ["pedidos", "Pedidos"],
  ["documentos", "Documentos"],
  ["historico", "Histórico"],
] as const;

const LC214 = new Date("2025-01-16T00:00:00Z");

export default async function ContratoPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const { aba = "resumo" } = await searchParams;
  const c = await db.contrato.findFirst({
    where: { id, empresa: { contaId: ctx.conta.id } },
    include: {
      convencao: true,
      empresa: true,
      pedidos: { orderBy: { criadoEm: "desc" } },
      documentos: { orderBy: { criadoEm: "desc" } },
      historicos: { orderBy: { criadoEm: "desc" }, include: { usuario: true }, take: 100 },
    },
  });
  if (!c) notFound();
  const convencoes = await db.convencao.findMany({ where: { contaId: ctx.conta.id }, orderBy: { ano: "desc" } });
  const op = oportunidade(c);
  const protocolado = c.pedidos.find((p) => p.estado === "PROTOCOLADO");
  const faturado = c.pedidos.find((p) => p.estado === "FATURADO" || p.estado === "DEFERIDO");
  const principal = protocolado
    ? { texto: "Registrar resposta do órgão", href: `/app/pedidos/${protocolado.id}/pronto` }
    : faturado
      ? { texto: faturado.estado === "FATURADO" ? "Marcar como recebido" : "Faturar a diferença", href: "/app/a-receber" }
      : op?.pedidoAberto
        ? { texto: "Continuar pedido de repactuação", href: `/app/pedidos/${op.pedidoAberto.id}` }
        : { texto: "Montar pedido de repactuação", href: `/app/pedidos/novo?contrato=${c.id}` };
  const elegivelReforma = (c.dataProposta ?? c.vigenciaInicio) < LC214;
  const podeEditar = pode(ctx.papel, "editar_contratos");

  return (
    <>
      <div className="app-cab">
        <div>
          <p className="legenda mb-0">
            <Link href="/app/carteira">Carteira</Link> · {c.empresa.razaoSocial}
          </p>
          <h1>
            Contrato {c.numero} · {c.orgao}
            {c.uf ? ` (${c.uf})` : ""}
          </h1>
          <div className="fileira mt-16">
            <Selo selo={seloSituacao(c)} />
            {elegivelReforma && <SeloSimples texto="Pode ter reequilíbrio da LC 214/2025" tom="azul" icone="alerta" />}
          </div>
        </div>
        {pode(ctx.papel, "editar_pedidos") && c.tipoReajuste === "REPACTUACAO" && (
          <Link href={principal.href} className="btn btn-primario">
            {principal.texto}
          </Link>
        )}
      </div>

      <nav className="abas" aria-label="Seções do contrato">
        {ABAS.map(([k, n]) => (
          <Link key={k} href={`/app/contratos/${c.id}?aba=${k}`} aria-current={aba === k ? "page" : undefined}>
            {n}
          </Link>
        ))}
      </nav>

      {aba === "resumo" && (
        <div className="grade-2" style={{ alignItems: "start" }}>
          <div className="cartao">
            <h2>Resumo</h2>
            <dl className="dl-resumo">
              <dt>Objeto</dt>
              <dd>{c.objeto}</dd>
              <dt>Vigência</dt>
              <dd>
                {data(c.vigenciaInicio)} a {data(c.vigenciaFim)} ({emDias(diasAte(c.vigenciaFim))})
              </dd>
              <dt>Postos</dt>
              <dd>{c.postos ?? "não informado"}</dd>
              <dt>Valor mensal</dt>
              <dd>{c.valorMensal ? reais(c.valorMensal) : "não informado"}</dd>
              {c.valorGlobal && (
                <>
                  <dt>Valor global (PNCP)</dt>
                  <dd>{reais(c.valorGlobal)}</dd>
                </>
              )}
              <dt>Atualização de preço</dt>
              <dd>{c.tipoReajuste === "INDICE" ? "Reajuste por índice" : "Repactuação"}</dd>
              <dt>Convenção</dt>
              <dd>
                {c.convencao ? (
                  <>
                    {c.convencao.nome} · data-base {MESES[c.convencao.mesDataBase - 1]}
                  </>
                ) : (
                  <span className="erro-texto">Não informada</span>
                )}
              </dd>
              <dt>Último apostilamento</dt>
              <dd>{data(c.ultimoApostilamento)}</dd>
              <dt>Reforma tributária</dt>
              <dd>
                {elegivelReforma
                  ? "Contrato ou proposta anterior à LC 214/2025: pode ter direito ao reequilíbrio da lei, com prova da carga efetiva."
                  : "Posterior à LC 214/2025: fora do regime especial."}
              </dd>
              {c.linkPncp && (
                <>
                  <dt>PNCP</dt>
                  <dd>
                    <a href={c.linkPncp} target="_blank" rel="noreferrer">
                      Ver o contrato no PNCP <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="cartao">
            <h2>{podeEditar ? "Editar dados" : "Dados"}</h2>
            <FormContrato action={editarContrato} contrato={c} convencoes={convencoes} empresas={ctx.empresas} somenteLeitura={!podeEditar} />
            {podeEditar && (
              <FormAcao action={arquivarContrato} confirmar="Arquivar este contrato? Ele sai da carteira e dos avisos." className="mt-16">
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn btn-texto">
                  Arquivar contrato
                </button>
              </FormAcao>
            )}
          </div>
        </div>
      )}

      {aba === "prazos" && (
        <div className="cartao">
          <h2>Prazos</h2>
          <ol className="linha-tempo">
            {prazosDoContrato(c).map((p, i) => (
              <li key={i} className={diasAte(p.data) <= 30 && diasAte(p.data) >= 0 ? "urgente" : undefined} style={{ paddingBottom: 24 }}>
                <strong>{data(p.data)}</strong> · {emDias(diasAte(p.data))}
                <div style={{ fontSize: 15 }}>{p.titulo}</div>
                {p.regra && <FonteRegra regra={p.regra} />}
              </li>
            ))}
          </ol>
          <Link href={`/app/contratos/${c.id}/prorrogacao`} className="btn">
            Decidir antes da prorrogação
          </Link>
        </div>
      )}

      {aba === "pedidos" && (
        <div className="cartao">
          <h2>Pedidos</h2>
          {c.pedidos.length === 0 ? (
            <p className="secundario">Nenhum pedido ainda.</p>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Criado em</th>
                    <th>Situação</th>
                    <th className="num">Diferença por mês</th>
                    <th className="num">Desde a data-base</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.pedidos.map((p) => (
                    <tr key={p.id}>
                      <td>{dataLocal(p.criadoEm)}</td>
                      <td>{NOME_ESTADO[p.estado]}</td>
                      <td className="num">{p.diferencaMensal ? reais(p.diferencaMensal) : "—"}</td>
                      <td className="num">{p.diferencaRetroativa ? reais(p.diferencaRetroativa) : "—"}</td>
                      <td>
                        <Link href={["EM_ANALISE"].includes(p.estado) ? `/app/pedidos/${p.id}` : `/app/pedidos/${p.id}/pronto`}>Abrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === "documentos" && (
        <div className="grade-2" style={{ alignItems: "start" }}>
          <div className="cartao">
            <h2>Documentos</h2>
            {c.documentos.length === 0 ? (
              <p className="secundario">Nenhum documento ainda.</p>
            ) : (
              <ul className="lista-limpa pilha-8">
                {c.documentos.map((d) => (
                  <li key={d.id} className="entre" style={{ fontSize: 14 }}>
                    <a href={`/api/documentos/${d.id}`}>{d.nome}</a>
                    <span className="legenda">
                      {d.tipo.toLowerCase()} · v{d.versao} · {dataLocal(d.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pode(ctx.papel, "editar_pedidos") && (
            <div className="cartao">
              <h2>Anexar documento</h2>
              <FormAcao action={enviarDocumentoContrato} limparAoSalvar>
                <input type="hidden" name="contratoId" value={c.id} />
                <div className="campo">
                  <label htmlFor="tipo">Tipo</label>
                  <select id="tipo" name="tipo">
                    <option value="CONTRATO">Contrato ou termo aditivo</option>
                    <option value="PLANILHA">Planilha de custos</option>
                    <option value="OFICIO">Ofício</option>
                    <option value="PROTOCOLO">Protocolo</option>
                    <option value="APOSTILAMENTO">Apostilamento</option>
                    <option value="NOTA_FISCAL">Nota fiscal</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="arquivo">Arquivo (PDF, Excel, Word ou imagem, até 15 MB)</label>
                  <input id="arquivo" name="arquivo" type="file" accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg,.csv" />
                </div>
                <BotaoEnvio className="btn" pendente="Enviando…">
                  Anexar
                </BotaoEnvio>
              </FormAcao>
            </div>
          )}
        </div>
      )}

      {aba === "historico" && (
        <div className="cartao">
          <h2>Histórico</h2>
          {c.historicos.length === 0 ? (
            <p className="secundario">Nada registrado ainda.</p>
          ) : (
            <ul className="lista-limpa pilha-8">
              {c.historicos.map((h) => (
                <li key={h.id} style={{ fontSize: 14 }}>
                  <span className="legenda">{dataHora(h.criadoEm)}</span> · <strong>{h.usuario?.nome ?? "Sistema"}</strong> · {h.acao}
                  {h.detalhe ? ` (${h.detalhe})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
