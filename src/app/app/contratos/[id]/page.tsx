import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileUp,
  History,
  Pencil,
  PlusCircle,
  Stamp,
  Upload,
  DollarSign,
  Gavel,
} from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { data, dataHora, dataLocal, diasAte, emDias, MESES, plural, reais } from "@/lib/format";
import { oportunidade, prazosDoContrato, seloSituacao } from "@/lib/prazos";
import { NOME_ESTADO } from "@/lib/pedido";
import { contratoParaForm, convencoesParaForm } from "@/lib/dto";
import { Selo, SeloSimples } from "@/components/selo";
import { FonteRegra } from "@/components/fonte-regra";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { AreaArquivo } from "@/components/ui/arquivo";
import { CampoSelect } from "@/components/ui/campos";
import { CabecalhoPagina, Termo } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { enviarDocumentoContrato, usarVigenciaPncp } from "../../acoes";
import { divergenciaPncp } from "@/lib/pncp-vigencia";
import { EditarContrato } from "./editar-contrato";
import { ItemArquivar } from "./arquivar";
import { HistoricoOrgao } from "@/components/historico-orgao";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await db.contrato.findUnique({ where: { id }, select: { numero: true } });
  return { title: c ? `Contrato ${c.numero} | Equapar` : "Contrato | Equapar" };
}

const LC214 = new Date("2025-01-16T00:00:00Z");

const TIPOS_DOC = [
  { valor: "CONTRATO", rotulo: "Contrato ou termo aditivo" },
  { valor: "PLANILHA", rotulo: "Planilha de custos" },
  { valor: "OFICIO", rotulo: "Ofício" },
  { valor: "PROTOCOLO", rotulo: "Protocolo" },
  { valor: "APOSTILAMENTO", rotulo: "Apostilamento" },
  { valor: "NOTA_FISCAL", rotulo: "Nota fiscal" },
  { valor: "OUTRO", rotulo: "Outro" },
];
const NOME_TIPO_DOC = Object.fromEntries(TIPOS_DOC.map((t) => [t.valor, t.rotulo])) as Record<string, string>;

function iconeHistorico(acao: string) {
  if (/protocolo/i.test(acao)) return FileUp;
  if (/deferi|apostil/i.test(acao)) return Stamp;
  if (/fatur|recebid/i.test(acao)) return DollarSign;
  if (/aprovou|memória/i.test(acao)) return CheckCircle2;
  if (/anexou|enviou|documento|planilha/i.test(acao)) return Upload;
  if (/iniciou|gerou/i.test(acao)) return FileText;
  if (/editou/i.test(acao)) return Pencil;
  if (/arquivou/i.test(acao)) return Archive;
  if (/cadastrou|importou/i.test(acao)) return PlusCircle;
  if (/indeferi/i.test(acao)) return Gavel;
  return History;
}

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
      prorrogacoes: { orderBy: { dataTermo: "asc" } },
    },
  });
  if (!c) notFound();
  const convencoes = await db.convencao.findMany({ where: { contaId: ctx.conta.id }, orderBy: { ano: "desc" } });
  const op = oportunidade(c);
  const protocolado = c.pedidos.find((p) => p.estado === "PROTOCOLADO");
  const aReceber = c.pedidos.find((p) => p.estado === "FATURADO" || p.estado === "DEFERIDO");
  const principal = protocolado
    ? { texto: "Registrar resposta do órgão", href: `/app/pedidos/${protocolado.id}/pronto` }
    : aReceber
      ? { texto: aReceber.estado === "FATURADO" ? "Marcar como recebido" : "Faturar a diferença", href: `/app/pedidos/${aReceber.id}/pronto` }
      : op?.pedidoAberto
        ? { texto: "Continuar pedido de repactuação", href: `/app/pedidos/${op.pedidoAberto.id}` }
        : { texto: "Montar pedido de repactuação", href: `/app/pedidos/novo?contrato=${c.id}` };
  const elegivelReforma = (c.dataProposta ?? c.vigenciaInicio) < LC214;
  const podeEditar = pode(ctx.papel, "editar_contratos");
  const podePedidos = pode(ctx.papel, "editar_pedidos");
  const diasFim = diasAte(c.vigenciaFim);
  const abas = [
    ["resumo", "Resumo", null],
    ["prazos", "Prazos", null],
    ["pedidos", "Pedidos", c.pedidos.length],
    ["documentos", "Documentos", c.documentos.length],
    ["historico", "Histórico", null],
  ] as const;

  return (
    <>
      <CabecalhoPagina
        trilha={[{ rotulo: "Carteira", href: "/app/carteira" }, { rotulo: `Contrato ${c.numero}` }]}
        titulo={`Contrato ${c.numero} · ${c.orgao}${c.uf ? ` (${c.uf})` : ""}`}
        selo={<Selo selo={seloSituacao(c)} />}
        subtitulo={ctx.conta.tipo === "ASSESSORIA" ? c.empresa.razaoSocial : undefined}
        acao={
          podePedidos && c.tipoReajuste === "REPACTUACAO" ? (
            <Link href={principal.href} className="btn btn-primario">
              {principal.texto}
            </Link>
          ) : undefined
        }
        menu={
          <>
            <Link href={`/app/contratos/${c.id}/prorrogacao`} role="menuitem">
              <CalendarClock size={16} strokeWidth={1.5} aria-hidden /> Decidir antes da prorrogação
            </Link>
            {c.linkPncp && (
              <a href={c.linkPncp} target="_blank" rel="noreferrer" role="menuitem">
                <ExternalLink size={16} strokeWidth={1.5} aria-hidden /> Ver no PNCP
              </a>
            )}
            {podeEditar && (
              <>
                <hr />
                <ItemArquivar id={c.id} numero={c.numero} />
              </>
            )}
          </>
        }
      />
      {elegivelReforma && (
        <p className="mb-16">
          <SeloSimples texto="Pode ter reequilíbrio da reforma tributária (LC 214/2025)" tom="azul" icone="alerta" />
        </p>
      )}

      <nav className="abas" aria-label="Seções do contrato">
        {abas.map(([k, n, qtd]) => (
          <Link key={k} href={`/app/contratos/${c.id}?aba=${k}`} aria-current={aba === k ? "page" : undefined} scroll={false}>
            {n}
            {qtd !== null && <span className="contador"> ({qtd})</span>}
          </Link>
        ))}
      </nav>

      {aba === "resumo" && (
        <div className="cartao">
          <div className="cartao-cab">
            <h2>Resumo</h2>
            {podeEditar && (
              <EditarContrato
                contrato={contratoParaForm(c)}
                convencoes={convencoesParaForm(convencoes)}
                empresas={ctx.empresas.map((e) => ({ id: e.id, razaoSocial: e.razaoSocial }))}
              />
            )}
          </div>
          <dl className="dl-resumo">
            <dt>Objeto</dt>
            <dd>{c.objeto}</dd>
            <dt>Vigência</dt>
            <dd>
              {data(c.vigenciaInicio)} a {data(c.vigenciaFim)} <span className="secundario">({emDias(diasFim)})</span>
              {divergenciaPncp(c) && (
                <span className="legenda" style={{ display: "block" }}>
                  PNCP: {data(c.vigenciaFimPncp)} · você registrou: {data(c.vigenciaFim)}.
                  {podeEditar && (
                    <FormAcao action={usarVigenciaPncp} className="fileira mt-8">
                      <input type="hidden" name="contratoId" value={c.id} />
                      <BotaoEnvio className="btn btn-pequeno">Usar a data do PNCP</BotaoEnvio>
                    </FormAcao>
                  )}
                </span>
              )}
            </dd>
            {c.prorrogacoes.length > 0 && (
              <>
                <dt>Prorrogações</dt>
                <dd>
                  <ul className="lista-limpa">
                    {c.prorrogacoes.map((pr) => (
                      <li key={pr.id}>
                        Até {data(pr.novoFim)} (termo de {data(pr.dataTermo)}) · {pr.comRessalva ? "com ressalva do direito à repactuação" : "sem ressalva"}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
            <dt>Postos</dt>
            <dd>{c.postos != null ? plural(c.postos, "posto", "postos") : <span className="secundario">Não informado</span>}</dd>
            <dt>Valor mensal</dt>
            <dd className="tnum">{c.valorMensal ? reais(c.valorMensal) : <span className="secundario">Não informado</span>}</dd>
            {c.valorGlobal && (
              <>
                <dt>Valor global (PNCP)</dt>
                <dd className="tnum">{reais(c.valorGlobal)}</dd>
              </>
            )}
            <dt>Atualização de preço</dt>
            <dd>{c.tipoReajuste === "INDICE" ? "Reajuste por índice" : <Termo>Repactuação</Termo>}</dd>
            <dt>Convenção</dt>
            <dd>
              {c.convencao ? (
                <>
                  {c.convencao.nome} · <Termo>data-base</Termo> em {MESES[c.convencao.mesDataBase - 1]}
                </>
              ) : (
                <SeloSimples texto="Não informada" tom="ambar" icone="alerta" />
              )}
            </dd>
            <dt>
              Último <Termo>apostilamento</Termo>
            </dt>
            <dd>{c.ultimoApostilamento ? data(c.ultimoApostilamento) : <span className="secundario">Nenhum registrado</span>}</dd>
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
      )}
      {aba === "resumo" && (
        <div className="mt-16">
          <HistoricoOrgao contaId={ctx.conta.id} orgao={c.orgao} orgaoCnpj={c.orgaoCnpj} />
        </div>
      )}

      {aba === "prazos" && (
        <div className="cartao">
          <div className="cartao-cab">
            <h2>Prazos</h2>
            <Link href={`/app/contratos/${c.id}/prorrogacao`} className={diasFim >= 0 && diasFim <= 60 ? "btn btn-primario" : "btn"}>
              Decidir antes da prorrogação
            </Link>
          </div>
          {diasFim >= 0 && diasFim <= 60 && (
            <p className="mb-16">
              <SeloSimples texto={`A vigência termina ${emDias(diasFim)}. Decida antes de assinar a prorrogação.`} tom={diasFim <= 30 ? "carimbo" : "ambar"} icone="relogio" />
            </p>
          )}
          <ol className="linha-tempo">
            {prazosDoContrato(c).map((p, i) => (
              <li key={i} className={diasAte(p.data) <= 30 && diasAte(p.data) >= 0 ? "urgente" : undefined} style={{ paddingBottom: 24 }}>
                <strong className="tnum">{data(p.data)}</strong> · {emDias(diasAte(p.data))}
                <div style={{ fontSize: 15 }}>{p.titulo}</div>
                {p.regra && <FonteRegra regra={p.regra} />}
              </li>
            ))}
          </ol>
        </div>
      )}

      {aba === "pedidos" &&
        (c.pedidos.length === 0 ? (
          <EstadoVazio
            icone={FileText}
            titulo="Nenhum pedido ainda"
            porque="Os pedidos de repactuação deste contrato aparecem aqui, do cálculo até o recebimento."
            acao={
              podePedidos && c.tipoReajuste === "REPACTUACAO" ? (
                <Link href={principal.href} className="btn btn-primario">
                  {principal.texto}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Criado em</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="num">
                    Diferença por mês
                  </th>
                  <th scope="col" className="num">
                    Desde a data-base
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.pedidos.map((p) => (
                  <tr key={p.id} className="linha-clicavel">
                    <td>
                      <Link className="linha-link" href={p.estado === "EM_ANALISE" ? `/app/pedidos/${p.id}` : `/app/pedidos/${p.id}/pronto`}>
                        {dataLocal(p.criadoEm)}
                      </Link>
                    </td>
                    <td>{NOME_ESTADO[p.estado]}</td>
                    <td className="num">{p.diferencaMensal ? reais(p.diferencaMensal) : "—"}</td>
                    <td className="num">{p.diferencaRetroativa ? reais(p.diferencaRetroativa) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {aba === "documentos" && (
        <div className="grade-2">
          <div className="cartao">
            <h2>Documentos</h2>
            {c.documentos.length === 0 ? (
              <p className="secundario mb-0">Nenhum documento ainda. Guarde aqui contrato, aditivos, planilhas, ofícios e protocolos, com versão e data.</p>
            ) : (
              <ul className="lista-limpa pilha-8">
                {c.documentos.map((d) => (
                  <li key={d.id} className="cartao-linha entre" style={{ boxShadow: "none" }}>
                    <span className="fileira" style={{ minWidth: 0, flexWrap: "nowrap" }}>
                      <FileText size={18} strokeWidth={1.5} aria-hidden style={{ color: "var(--grafite)", flexShrink: 0 }} />
                      <a href={`/api/documentos/${d.id}`}>{d.nome}</a>
                    </span>
                    <span className="legenda">
                      {NOME_TIPO_DOC[d.tipo] ?? d.tipo} · versão {d.versao} · {dataLocal(d.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {podePedidos && (
            <div className="cartao">
              <h2>Anexar documento</h2>
              <FormAcao action={enviarDocumentoContrato} limparAoSalvar>
                <input type="hidden" name="contratoId" value={c.id} />
                <CampoSelect nome="tipo" rotulo="Tipo" opcoes={TIPOS_DOC} valorInicial="CONTRATO" />
                <AreaArquivo tipos={["pdf", "excel", "word", "imagem"]} />
                <div className="mt-16">
                  <BotaoEnvio>Anexar</BotaoEnvio>
                </div>
              </FormAcao>
            </div>
          )}
        </div>
      )}

      {aba === "historico" && (
        <div className="cartao">
          <h2>Histórico</h2>
          {c.historicos.length === 0 ? (
            <p className="secundario mb-0">Nada registrado ainda. Cada alteração, envio e etapa fica aqui, com quem fez e quando.</p>
          ) : (
            <ul className="lista-limpa historico">
              {c.historicos.map((h) => {
                const I = iconeHistorico(h.acao);
                const d = diasAte(h.criadoEm);
                return (
                  <li key={h.id}>
                    <span className="historico-icone" aria-hidden>
                      <I size={16} strokeWidth={1.5} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontWeight: 500 }}>{h.acao}</strong>
                      {h.detalhe ? <span className="secundario"> ({h.detalhe})</span> : null}
                      <span className="legenda" style={{ display: "block" }}>
                        {h.usuario?.nome ?? "Sistema"} · <time dateTime={h.criadoEm.toISOString()} title={dataHora(h.criadoEm)}>{d === 0 ? `hoje, ${dataHora(h.criadoEm).split(" ")[1]}` : emDias(d)}</time>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
