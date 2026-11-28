import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { contexto, pedidoDaConta, podeNaConta } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, calcularRetroativo } from "@/lib/calculo/motor";
import { calcularPedido, ESTADOS } from "@/lib/pedido";
import { data, dataHora, dataLocal, diasAte, emDias, paraInputData, hojeUTC, reais } from "@/lib/format";
import { FONTES, prazoResposta } from "@/lib/prazos";
import { Carimbo, SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FonteRegra } from "@/components/fonte-regra";
import { CampoData, CampoDinheiro, CampoSelect, CampoTexto, RadiosCartao, TextoLongo } from "@/components/ui/campos";
import { Alerta, CabecalhoPagina, Termo } from "@/components/ui/estrutura";
import { aprovarMemoria, cancelarLancamento, gerarCobranca, marcarRecebido, novoPedidoAPartirDe, registrarApostilamento, registrarProtocolo, registrarRecurso, registrarResposta } from "../../acoes";
import { HistoricoOrgao } from "@/components/historico-orgao";
import { jornadaEmSimulacao, MARCA_SIMULACAO_JORNADA } from "@/lib/jornada-acesso";
import { resumoFinanceiro } from "@/lib/financeiro-pedido";
import { aprovacaoValida } from "@/lib/pedido-regras";

export const metadata: Metadata = { title: "Pedido | Equapar" };

const ARQUIVOS = [
  { href: "oficio.docx", nome: "Ofício (Word)", icone: FileText },
  { href: "oficio.pdf", nome: "Ofício (PDF)", icone: FileText },
  { href: "planilha.xlsx", nome: "Planilha (Excel)", icone: FileSpreadsheet },
  { href: "memoria.pdf", nome: "Memória de cálculo (PDF)", icone: FileText },
  { href: "pacote.zip", nome: "Tudo com os anexos (ZIP)", icone: FileArchive },
];

export default async function Pronto({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const p = await pedidoDaConta(ctx, id);
  const calc = calcularPedido(p);
  const [historico, todasNotas, todasBaixas] = await Promise.all([
    db.historico.findMany({ where: { pedidoId: p.id }, include: { usuario: true }, orderBy: { criadoEm: "desc" } }),
    db.notaFiscalPedido.findMany({ where: { pedidoId: p.id }, orderBy: { emitidaEm: "asc" } }),
    db.baixaPedido.findMany({ where: { pedidoId: p.id }, orderBy: { recebidoEm: "asc" } }),
  ]);
  // lançamentos cancelados não entram em nenhuma conta; aparecem à parte, só para registro
  const notas = todasNotas.filter((n) => !n.canceladaEm);
  const baixas = todasBaixas.filter((b) => !b.canceladaEm);
  const notasCanceladas = todasNotas.filter((n) => n.canceladaEm);
  const baixasCanceladas = todasBaixas.filter((b) => b.canceladaEm);
  const idx = ESTADOS.findIndex((e) => e.id === p.estado);
  const fin = podeNaConta(ctx, "registrar_financeiro");
  const hoje = paraInputData(hojeUTC());
  const c = calc.comparacao && !calc.comparacao.erros.length ? calc.comparacao : null;
  const financeiro = resumoFinanceiro(p.retroativoAprovado ?? p.valorDeferido ?? 0, notas, baixas);
  const versaoFinal = aprovacaoValida(p) && !!p.memoriaVersaoAprovadaId;
  // com a versão atual pendente, aprovar é a ação principal; as demais ficam secundárias
  const aprovarPrimeiro = !versaoFinal && podeNaConta(ctx, "aprovar_memoria");

  if (p.estado === "EM_ANALISE")
    return (
      <Alerta
        tipo="info"
        titulo="Este pedido ainda está sendo montado"
        acao={
          <Link href={`/app/pedidos/${p.id}`} className="btn btn-primario">
            Continuar o pedido
          </Link>
        }
      />
    );

  const datas: Record<string, string | null> = {
    // pedido importado ou anterior ao sistema: a data de criação do registro é posterior às etapas; não mostra
    EM_ANALISE: [p.geradoEm, p.protocoloData, p.deferidoEm].some((d) => d && d < p.criadoEm) ? null : dataLocal(p.criadoEm),
    CALCULO_VALIDADO: p.geradoEm ? dataLocal(p.geradoEm) : null,
    PROTOCOLADO: p.protocoloData ? data(p.protocoloData) : null,
    DEFERIDO: p.deferidoEm ? data(p.deferidoEm) : null,
    FATURADO: p.faturadoEm ? data(p.faturadoEm) : null,
    RECEBIDO: p.recebidoEm ? data(p.recebidoEm) : null,
  };

  const arquivos = (
    <section className="cartao" aria-labelledby="arquivos">
      <h2 id="arquivos">Arquivos do pedido</h2>
      {!versaoFinal && <p className="legenda mb-16">Os arquivos finais liberam quando a versão atual da memória for aprovada. Até lá, cada download sai como rascunho.</p>}
      <ul className="lista-limpa pilha-8">
        {[...ARQUIVOS.slice(0, -1), ...(p.gatilho === "JORNADA_EC141"
          ? [
              { href: "fundamentacao.pdf", nome: "Fundamentação normativa (PDF)", icone: FileText },
              { href: "retroativo.pdf", nome: "Demonstrativo retroativo por competência (PDF)", icone: FileText },
              { href: "aditivo.pdf", nome: "Minuta do termo aditivo (PDF)", icone: FileText },
            ]
          : []), ARQUIVOS[ARQUIVOS.length - 1]].map((a) => (
          <li key={a.href}>
            <a href={`/api/pedidos/${p.id}/arquivos/${a.href}${versaoFinal ? "" : "?rascunho=1"}`} className="cartao-linha arquivo-pedido" style={{ boxShadow: "none" }} download>
              <a.icone size={18} strokeWidth={1.5} aria-hidden />
              <span className="arquivo-pedido-nome">{a.nome}</span>
              {!versaoFinal && <span className="selo selo-neutro selo-mini">Rascunho</span>}
            </a>
          </li>
        ))}
      </ul>
      <p className="legenda mt-16 mb-0">O ofício é uma minuta: revise com seu jurídico antes de protocolar.</p>
    </section>
  );

  // "Cancelar lançamento" (Dono ou Gerente): motivo obrigatório, confirmação e registro no histórico
  const cancelar = (tipo: "nota" | "baixa", lancamentoId: string, descricao: string, aviso: string) =>
    fin && (
      <details className="mt-8">
        <summary style={{ cursor: "pointer" }} className="legenda">
          Cancelar lançamento
        </summary>
        <FormAcao
          action={cancelarLancamento}
          className="pilha-8 mt-8"
          confirmar={{ titulo: `Cancelar ${descricao}?`, texto: `${aviso} O lançamento fica registrado como cancelado, com o motivo no histórico.`, confirmar: "Cancelar lançamento", perigo: true }}
        >
          <input type="hidden" name="pedidoId" value={p.id} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="lancamentoId" value={lancamentoId} />
          <CampoTexto nome="motivo" rotulo="Motivo do cancelamento" maxLength={300} ajuda="Ex.: valor digitado errado. Fica no histórico do pedido." />
          <BotaoEnvio className="btn">Cancelar lançamento</BotaoEnvio>
        </FormAcao>
      </details>
    );
  const temCancelados = notasCanceladas.length + baixasCanceladas.length > 0;

  // Notas fiscais e baixas, com o recebido de cada nota em Decimal (mesma conta do resumo financeiro)
  const lancamentos = (notas.length > 0 || temCancelados) && (
    <div className="mt-16">
      <h3>Notas fiscais e recebimentos</h3>
      <ul className="lista-limpa pilha-8">
        {notas.map((nota) => (
          <li key={nota.id}>
            NF {nota.identificacao} de {data(nota.emitidaEm)}: {brl(nota.valor.toString())} faturado · {brl(resumoFinanceiro(nota.valor, [nota], baixas).recebido)} recebido
            {baixas.filter((b) => b.notaFiscalId === nota.id).length > 0 && (
              <ul className="legenda">
                {baixas
                  .filter((b) => b.notaFiscalId === nota.id)
                  .map((b) => (
                    <li key={b.id}>
                      Baixa de {brl(b.valor.toString())} em {data(b.recebidoEm)} · ref. {b.referenciaOperacao}
                      {b.autorNome ? ` · ${b.autorNome}` : ""}
                      {cancelar("baixa", b.id, `o recebimento de ${brl(b.valor.toString())}`, "O valor volta a constar como a receber.")}
                    </li>
                  ))}
              </ul>
            )}
            {!baixas.some((b) => b.notaFiscalId === nota.id) &&
              cancelar("nota", nota.id, `a nota fiscal ${nota.identificacao}`, "O valor volta a constar como a faturar.")}
          </li>
        ))}
      </ul>
      {temCancelados && (
        <details className="mt-16">
          <summary style={{ cursor: "pointer" }} className="legenda">
            Lançamentos cancelados ({notasCanceladas.length + baixasCanceladas.length})
          </summary>
          <ul className="legenda">
            {notasCanceladas.map((n) => (
              <li key={n.id}>
                <s>
                  NF {n.identificacao} de {data(n.emitidaEm)}: {brl(n.valor.toString())}
                </s>{" "}
                · cancelada em {data(n.canceladaEm)}
              </li>
            ))}
            {baixasCanceladas.map((b) => (
              <li key={b.id}>
                <s>
                  Baixa de {brl(b.valor.toString())} em {data(b.recebidoEm)}
                </s>{" "}
                · cancelada em {data(b.canceladaEm)}
              </li>
            ))}
          </ul>
          <p className="legenda mb-0">O motivo de cada cancelamento está no histórico do pedido. Cancelados não entram em nenhum total.</p>
        </details>
      )}
    </div>
  );

  return (
    <>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Pedidos", href: "/app/pedidos" },
          { rotulo: `Contrato ${p.contrato.numero}`, href: `/app/contratos/${p.contrato.id}` },
          { rotulo: p.gatilho === "JORNADA_EC141" ? "Adequação à jornada (EC 141/2026)" : "Pedido de repactuação" },
        ]}
        titulo={p.gatilho === "JORNADA_EC141" ? "Adequação à jornada (EC 141/2026)" : "Pedido de repactuação"}
        subtitulo={`Contrato ${p.contrato.numero} · ${p.contrato.orgao}`}
      />

      {p.gatilho === "JORNADA_EC141" && jornadaEmSimulacao() && <Alerta tipo="erro" className="mb-16" titulo={MARCA_SIMULACAO_JORNADA} />}
      <ol className="estados" tabIndex={0} aria-label="Etapas do pedido até o dinheiro entrar">
        {ESTADOS.map((e, i) => (
          <li key={e.id} className={`${i <= idx && p.estado !== "INDEFERIDO" ? "feito" : ""} ${i === idx ? "atual" : ""}`} aria-current={i === idx ? "step" : undefined}>
            <strong className="estado-nome">
              {i < idx && p.estado !== "INDEFERIDO" && <Check size={14} strokeWidth={2.5} aria-hidden />}
              {e.nome}
            </strong>
            <span className="tnum">{datas[e.id] ?? ""}</span>
          </li>
        ))}
      </ol>

      {/* ============ Momento de pico: pronto para protocolar ============ */}
      {p.estado === "CALCULO_VALIDADO" && (
        <div className="grade-2 mt-24">
          <section className="cartao pico" aria-labelledby="pico">
            <Carimbo texto="PRONTO PARA PROTOCOLAR" grande />
            <h2 id="pico" className="mt-16">
              O pedido está pronto.
            </h2>
            {c && (
              <dl className="pico-valores">
                <div>
                  <dt>Diferença por mês</dt>
                  <dd>{brl(c.diferencaMensal)}</dd>
                </div>
                <div>
                  <dt>Desde a data-base</dt>
                  <dd>{calc.retroativo ? brl(calc.retroativo.total) : "—"}</dd>
                </div>
              </dl>
            )}
            <h3 className="mt-24">Próximo passo: protocolar</h3>
            <p className="secundario">Protocole pelo canal indicado no contrato: Compras.gov.br, sistema do órgão ou e-mail do fiscal. Depois registre aqui o número.</p>
            {fin ? (
              <FormAcao action={registrarProtocolo}>
                <input type="hidden" name="pedidoId" value={p.id} />
                <div className="linha-form">
                  <CampoTexto nome="protocoloNumero" id="protocoloNumero" rotulo="Número do protocolo" largura="medio" />
                  <CampoData nome="protocoloData" id="protocoloData" rotulo="Data do protocolo" valorInicial={hoje} mostrarRelativo={false} ajuda="" />
                  <CampoData nome="documentacaoCompletaEm" rotulo="Documentação completa entregue em" opcional valorInicial={hoje} mostrarRelativo={false} ajuda="É desta data confirmada que começa o prazo de resposta." />
                </div>
                <BotaoEnvio>Registrar protocolo</BotaoEnvio>
              </FormAcao>
            ) : (
              <p className="legenda">Dono ou Gerente de contratos registram o protocolo.</p>
            )}
            <p className="legenda mt-16 mb-0">
              Precisa ajustar a conta? <Link href={`/app/pedidos/${p.id}/passo/3`}>Voltar aos novos custos</Link> (a aprovação da memória é desfeita).
            </p>
          </section>
          {arquivos}
        </div>
      )}

      {/* ============ Aguardando o órgão ============ */}
      {p.estado === "PROTOCOLADO" && (
        <div className="grade-2 mt-24">
          <section className="cartao" aria-labelledby="aguardando">
            <SeloSimples texto="Aguardando o órgão" tom="azul" icone="ampulheta" />
            <h2 id="aguardando" className="mt-16">
              Protocolo {p.protocoloNumero}
            </h2>
            <p>Protocolado em {data(p.protocoloData)}.</p>
            {prazoResposta(p) && (
              <p>
                Documentação completa em {data(p.documentacaoCompletaEm)}. Resposta preferencial até <strong>{data(prazoResposta(p))}</strong> ({emDias(diasAte(prazoResposta(p)!))}).
              </p>
            )}
            {versaoFinal ? (
              !prazoResposta(p) && <Alerta tipo="atencao">O prazo de resposta ainda não começou: falta confirmar a data em que a documentação ficou completa.</Alerta>
            ) : (
              <Alerta tipo="atencao" titulo="Antes de seguir">
                <ol className="passos-pendentes">
                  <li>
                    <strong>Aprovar a versão atual da memória.</strong> A data registrada alterou a memória; os arquivos finais ficam bloqueados até a aprovação.
                    {podeNaConta(ctx, "aprovar_memoria") ? (
                      <FormAcao action={aprovarMemoria} className="mt-8">
                        <input type="hidden" name="pedidoId" value={p.id} />
                        <BotaoEnvio>Aprovar a versão atual</BotaoEnvio>
                      </FormAcao>
                    ) : (
                      <span className="legenda" style={{ display: "block" }}>
                        Contador ou Dono aprova.
                      </span>
                    )}
                  </li>
                  <li>
                    <strong>Registrar a resposta do órgão</strong> quando ela chegar{fin ? ", no formulário abaixo." : "."}
                  </li>
                </ol>
                {!prazoResposta(p) && <p className="mb-0 mt-8">O prazo de resposta ainda não começou: falta confirmar a data em que a documentação ficou completa.</p>}
              </Alerta>
            )}
            <div className="mt-16">
              <FonteRegra regra={FONTES.resposta} />
            </div>
            {fin && (
              <FormAcao action={registrarResposta} className="mt-24">
                <input type="hidden" name="pedidoId" value={p.id} />
                <h3>Registrar a resposta do órgão</h3>
                <RadiosCartao
                  nome="resultado"
                  legenda="Resultado"
                  valorInicial="TOTAL"
                  opcoes={[
                    { valor: "TOTAL", titulo: "Deferido integralmente", descricao: "O órgão aceitou o mensal e o retroativo solicitados." },
                    { valor: "PARCIAL", titulo: "Deferido parcialmente", descricao: "Registre separadamente o mensal e o retroativo aprovados." },
                    { valor: "INDEFERIDO", titulo: "Indeferido", descricao: "O órgão negou o pedido." },
                  ]}
                />
                <div className="linha-form">
                  <CampoData nome="respostaData" id="respostaData" rotulo="Data da resposta" valorInicial={hoje} mostrarRelativo={false} ajuda="" />
                  <CampoDinheiro nome="mensalAprovado" rotulo="Valor mensal aprovado" valorInicial={c?.mensalAgora} ajuda="No deferimento parcial, informe o novo valor mensal reconhecido pelo órgão." />
                  <CampoDinheiro nome="retroativoAprovado" rotulo="Retroativo aprovado" valorInicial={calc.retroativo?.total} ajuda="A diferença retroativa reconhecida pelo órgão." />
                </div>
                {/* parecer de 28/11/2026 (A2): efeitos reconhecidos pela Administração, separados dos efeitos pedidos */}
                {p.gatilho === "JORNADA_EC141" && (
                  <CampoData
                    nome="jornadaEfeitosReconhecidos"
                    rotulo="Efeitos financeiros reconhecidos a partir de"
                    opcional
                    valorInicial={p.jornadaEfeitosReconhecidos ? paraInputData(p.jornadaEfeitosReconhecidos) : null}
                    mostrarRelativo={false}
                    ajuda="A data que o órgão reconheceu, se for diferente da pedida."
                  />
                )}
                <TextoLongo nome="respostaResumo" rotulo="Resumo da resposta" opcional limite={1000} />
                <TextoLongo nome="decisaoEvidencia" rotulo="Fundamento ou documento da decisão" opcional ajuda="Obrigatório para deferimento parcial." limite={1000} />
                <BotaoEnvio className={aprovarPrimeiro ? "btn" : undefined}>Registrar resposta</BotaoEnvio>
              </FormAcao>
            )}
          </section>
          {arquivos}
        </div>
      )}

      {/* ============ Momento de pico: deferido ============ */}
      {(p.estado === "DEFERIDO" || p.estado === "FATURADO") && (
        <div className="grade-2 mt-24">
          <section className="cartao pico" aria-labelledby="deferido">
            <Carimbo texto="DEFERIDO" grande />
            <dl className="pico-valores mt-16">
              <div>
                <dt>Total ainda pendente</dt>
                <dd>{brl(financeiro.totalPendente)}</dd>
              </div>
            </dl>
            <dl className="valores-compactos mt-16">
              <div>
                <dt>Mensal solicitado</dt>
                <dd>{p.mensalSolicitado != null ? reais(p.mensalSolicitado) : <span className="secundario">não registrado</span>}</dd>
              </div>
              <div>
                <dt>Mensal aprovado</dt>
                <dd>{p.mensalAprovado != null ? reais(p.mensalAprovado) : <span className="secundario">{p.conciliacaoPendente ? "a conciliar com o pedido anterior" : "não registrado"}</span>}</dd>
              </div>
              <div>
                <dt>Mensal anterior (antes deste pedido)</dt>
                <dd>{reais(p.mensalVigenteAnterior ?? p.contrato.valorMensal)}</dd>
              </div>
              <div>
                <dt>Retroativo aprovado</dt>
                <dd>{brl(financeiro.aprovado)}</dd>
              </div>
              <div>
                <dt>Total faturado</dt>
                <dd>{brl(financeiro.faturado)}</dd>
              </div>
              <div>
                <dt>Falta faturar</dt>
                <dd>{brl(financeiro.faltaFaturar)}</dd>
              </div>
              <div>
                <dt>Faturado a receber</dt>
                <dd>{brl(financeiro.faturadoAReceber)}</dd>
              </div>
            </dl>
            {p.diferencaMensal && p.dataBase && (
              // L11: só informação, à parte; não muda o pedido protocolado nem o valor deferido
              <p className="legenda mt-8 mb-0">
                Só para informação: com a diferença de {brl(p.diferencaMensal.toString())} por mês, a diferença acumulada desde a data-base até hoje seria de{" "}
                {brl(calcularRetroativo(p.diferencaMensal.toString(), p.dataBase, hojeUTC(), p.retroMesIncompleto).total)}.
              </p>
            )}
            {!versaoFinal && (
              <Alerta tipo="atencao" className="mt-16" titulo="Versão atual pendente de aprovação">
                A data efetiva alterou o corte do retroativo. Os arquivos finais continuam bloqueados.
                {podeNaConta(ctx, "aprovar_memoria") && (
                  <FormAcao action={aprovarMemoria} className="mt-8">
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <BotaoEnvio>Aprovar a versão atual</BotaoEnvio>
                  </FormAcao>
                )}
              </Alerta>
            )}
            <h2 id="deferido" className="mt-24">
              {p.estado === "FATURADO" ? "Próximo passo: confirmar o recebimento" : p.apostiladoEm ? "Próximo passo: faturar a diferença" : "Próximo passo: o apostilamento"}
            </h2>
            {p.estado === "DEFERIDO" && !p.apostiladoEm && (
              <>
                <p className="secundario">
                  Sem <Termo>apostilamento</Termo>, o órgão não paga a diferença. Registre a data quando sair.
                </p>
                {p.deferidoEm && diasAte(p.deferidoEm) <= -30 && (
                  <Alerta tipo="atencao" className="mb-16">
                    Deferido há mais de 30 dias e ainda sem apostilamento. Vale cobrar o fiscal do contrato.
                  </Alerta>
                )}
                {fin && (
                  <FormAcao action={registrarApostilamento}>
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <CampoData nome="apostiladoEm" rotulo="Data do apostilamento" valorInicial={hoje} mostrarRelativo={false} ajuda="" />
                    <BotaoEnvio className={aprovarPrimeiro ? "btn" : undefined}>Registrar apostilamento</BotaoEnvio>
                  </FormAcao>
                )}
              </>
            )}
            {p.apostiladoEm && fin && Number(financeiro.faltaFaturar) > 0 && (
              <FormAcao action={gerarCobranca}>
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="secundario">Apostilado em {data(p.apostiladoEm)}. Falta faturar {brl(financeiro.faltaFaturar)}; cada nota fica registrada separadamente.</p>
                <div className="linha-form">
                  <CampoTexto nome="notaFiscal" rotulo="Número da nota fiscal" largura="medio" />
                  <CampoData nome="faturadoEm" rotulo="Data da nota" valorInicial={hoje} mostrarRelativo={false} ajuda="" />
                  <CampoDinheiro nome="valorNota" rotulo="Valor desta nota" valorInicial={financeiro.faltaFaturar} />
                  <CampoTexto nome="referenciaOperacao" rotulo="Referência da operação" opcional ajuda="Use a mesma referência ao repetir o envio; assim não duplica." />
                </div>
                <BotaoEnvio className={aprovarPrimeiro ? "btn" : undefined}>Registrar nota fiscal</BotaoEnvio>
              </FormAcao>
            )}
            {p.estado === "FATURADO" && fin && (
              <FormAcao action={marcarRecebido}>
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="secundario">Faturado a receber: {brl(financeiro.faturadoAReceber)}. Registre cada pagamento na nota correspondente.</p>
                <div className="linha-form">
                  <CampoSelect nome="notaFiscalId" rotulo="Nota fiscal" opcoes={notas.map((nota) => ({ valor: nota.id, rotulo: `${nota.identificacao} · ${brl(nota.valor.toString())}` }))} />
                  <CampoData nome="recebidoEm" rotulo="Data do recebimento" valorInicial={hoje} mostrarRelativo={false} ajuda="" />
                  <CampoDinheiro nome="valorRecebido" rotulo="Valor recebido" valorInicial={financeiro.faturadoAReceber} />
                  <CampoTexto nome="referenciaOperacao" rotulo="Referência da baixa" opcional ajuda="Identificador bancário ou contábil; evita baixa duplicada." />
                </div>
                <BotaoEnvio className={aprovarPrimeiro ? "btn" : undefined}>Registrar recebimento</BotaoEnvio>
              </FormAcao>
            )}
            {lancamentos}
            {!fin && <p className="legenda">Dono ou Gerente de contratos registram estas etapas.</p>}
          </section>
          {arquivos}
        </div>
      )}

      {/* ============ Momento de pico: recebido ============ */}
      {p.estado === "RECEBIDO" && (
        <div className="grade-2 mt-24">
          <section className="cartao pico" aria-labelledby="recebido">
            <Carimbo texto="RECEBIDO" grande />
            <dl className="pico-valores mt-16">
              <div>
                <dt>Valor recebido</dt>
                <dd>{reais(p.valorRecebido)}</dd>
              </div>
              <div>
                <dt>Recebido em</dt>
                <dd style={{ fontSize: 20 }}>{data(p.recebidoEm)}</dd>
              </div>
            </dl>
            <h2 id="recebido" className="mt-24">
              A diferença entrou no caixa.
            </h2>
            <p className="secundario">Este pedido saiu da lista. O novo valor mensal já vale para os próximos faturamentos do contrato.</p>
            <Link href={`/app/contratos/${p.contrato.id}`} className="btn">
              Ver o contrato
            </Link>
            {lancamentos}
            <hr className="regua" />
            <h3>Caso pronto</h3>
            <p className="secundario">
              Um resumo de uma página deste resultado: valores, categoria e a linha do tempo do protocolo ao recebimento. Sai anônimo (tipo de órgão e UF), como rascunho.
            </p>
            <form method="get" action={`/api/pedidos/${p.id}/caso`} className="pilha-8">
              <label className="check">
                <input type="checkbox" name="identificado" value="1" />
                <span>Incluir o nome do órgão e o número do contrato</span>
              </label>
              <div className="fileira">
                <button type="submit" name="formato" value="pdf" className="btn">
                  Baixar caso (PDF)
                </button>
                <button type="submit" name="formato" value="md" className="btn">
                  Baixar texto
                </button>
              </div>
            </form>
            <p className="legenda mt-8 mb-0">Publicar o caso exige a autorização assinada do cliente, no modelo de autorização de publicação de caso.</p>
          </section>
          {arquivos}
        </div>
      )}

      {p.estado === "INDEFERIDO" && (
        <div className="grade-2 mt-24">
          <section className="cartao">
            <SeloSimples texto={`Indeferido em ${data(p.respostaData)}`} tom="carimbo" icone="alerta" />
            {p.respostaResumo && <p className="mt-16">{p.respostaResumo}</p>}
            <p className="secundario mt-16">Se o pedido foi negado por falta de prova, revise os documentos e a memória com um especialista antes de um novo pedido ou recurso.</p>
            {/* 5.5: recurso e novo pedido a partir deste */}
            {p.recursoPrazo && (
              <p className="mt-16 mb-0">
                <strong>Recurso:</strong> {p.recursoData ? `apresentado em ${data(p.recursoData)}, ` : "ainda não apresentado, "}prazo {data(p.recursoPrazo)}.
              </p>
            )}
            {podeNaConta(ctx, "editar_pedidos") && (
              <>
                <hr className="regua" />
                <h3>Registrar recurso</h3>
                <FormAcao action={registrarRecurso} className="pilha-8">
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <div className="linha-form">
                    <CampoData nome="recursoData" rotulo="Data em que o recurso foi apresentado" opcional valorInicial={p.recursoData ? paraInputData(p.recursoData) : null} mostrarRelativo={false} ajuda="Deixe em branco se ainda não apresentou." />
                    <CampoData nome="recursoPrazo" rotulo="Prazo do recurso" valorInicial={p.recursoPrazo ? paraInputData(p.recursoPrazo) : null} ajuda="Entra nos prazos do contrato e em Hoje." />
                  </div>
                  <BotaoEnvio className="btn">Registrar recurso</BotaoEnvio>
                </FormAcao>
                <hr className="regua" />
                <FormAcao action={novoPedidoAPartirDe}>
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <BotaoEnvio className="btn" pendente="Copiando planilhas e documentos…">
                    Começar um novo pedido a partir deste
                  </BotaoEnvio>
                  <p className="legenda mt-8 mb-0">Reaproveita o motivo, as planilhas e cópias dos documentos. Você revisa tudo antes de gerar de novo.</p>
                </FormAcao>
              </>
            )}
          </section>
          {arquivos}
        </div>
      )}

      <div className="mt-24">
        <HistoricoOrgao contaId={ctx.conta.id} orgao={p.contrato.orgao} orgaoCnpj={p.contrato.orgaoCnpj} />
      </div>

      <section className="cartao mt-24" aria-labelledby="hist">
        <h2 id="hist">Histórico</h2>
        {historico.length === 0 && <p className="secundario mb-0">Nada registrado neste pedido ainda.</p>}
        <ul className="lista-limpa pilha-8">
          {historico.map((h) => (
            <li key={h.id} style={{ fontSize: 14 }}>
              <span className="legenda">{dataHora(h.criadoEm)}</span> · {h.usuario?.nome ?? "Sistema"} · {h.acao}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
