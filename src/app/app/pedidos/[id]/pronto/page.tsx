import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, calcularRetroativo } from "@/lib/calculo/motor";
import { calcularPedido, ESTADOS } from "@/lib/pedido";
import { data, dataHora, dataLocal, diasAte, emDias, paraInputData, hojeUTC, reais } from "@/lib/format";
import { FONTES, prazoResposta } from "@/lib/prazos";
import { Carimbo, SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FonteRegra } from "@/components/fonte-regra";
import { CampoData, CampoDinheiro, CampoTexto, RadiosCartao, TextoLongo } from "@/components/ui/campos";
import { Alerta, CabecalhoPagina, Termo } from "@/components/ui/estrutura";
import { gerarCobranca, marcarRecebido, registrarApostilamento, registrarProtocolo, registrarResposta } from "../../acoes";
import { HistoricoOrgao } from "@/components/historico-orgao";

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
  const historico = await db.historico.findMany({ where: { pedidoId: p.id }, include: { usuario: true }, orderBy: { criadoEm: "desc" } });
  const idx = ESTADOS.findIndex((e) => e.id === p.estado);
  const fin = pode(ctx.papel, "registrar_financeiro");
  const hoje = paraInputData(hojeUTC());
  const c = calc.comparacao && !calc.comparacao.erros.length ? calc.comparacao : null;

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
    EM_ANALISE: dataLocal(p.criadoEm),
    CALCULO_VALIDADO: p.geradoEm ? dataLocal(p.geradoEm) : null,
    PROTOCOLADO: p.protocoloData ? data(p.protocoloData) : null,
    DEFERIDO: p.deferidoEm ? data(p.deferidoEm) : null,
    FATURADO: p.faturadoEm ? data(p.faturadoEm) : null,
    RECEBIDO: p.recebidoEm ? data(p.recebidoEm) : null,
  };

  const arquivos = (
    <section className="cartao" aria-labelledby="arquivos">
      <h2 id="arquivos">Arquivos do pedido</h2>
      <ul className="lista-limpa pilha-8">
        {[...ARQUIVOS.slice(0, -1), ...(p.gatilho === "JORNADA_EC141" ? [{ href: "aditivo.pdf", nome: "Minuta do termo aditivo (PDF)", icone: FileText }] : []), ARQUIVOS[ARQUIVOS.length - 1]].map((a) => (
          <li key={a.href}>
            <a href={`/api/pedidos/${p.id}/arquivos/${a.href}`} className="cartao-linha fileira" style={{ boxShadow: "none" }} download>
              <a.icone size={18} strokeWidth={1.5} aria-hidden /> {a.nome}
            </a>
          </li>
        ))}
      </ul>
      <p className="legenda mt-16 mb-0">O ofício é uma minuta: revise com seu jurídico antes de protocolar.</p>
    </section>
  );

  return (
    <>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Pedidos", href: "/app/pedidos" },
          { rotulo: `Contrato ${p.contrato.numero}`, href: `/app/contratos/${p.contrato.id}` },
          { rotulo: "Pedido de repactuação" },
        ]}
        titulo="Pedido de repactuação"
        subtitulo={`Contrato ${p.contrato.numero} · ${p.contrato.orgao}`}
      />

      <ol className="estados" tabIndex={0} aria-label="Etapas do pedido até o dinheiro entrar">
        {ESTADOS.map((e, i) => (
          <li key={e.id} className={`${i <= idx && p.estado !== "INDEFERIDO" ? "feito" : ""} ${i === idx ? "atual" : ""}`} aria-current={i === idx ? "step" : undefined}>
            <strong className="fileira" style={{ gap: 4 }}>
              {i < idx && p.estado !== "INDEFERIDO" && <Check size={12} strokeWidth={2.5} aria-hidden />}
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
                  <CampoData nome="protocoloData" id="protocoloData" rotulo="Data do protocolo" valorInicial={hoje} mostrarRelativo={false} />
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
            <p>
              Protocolado em {data(p.protocoloData)}. Resposta preferencial até <strong>{data(prazoResposta(p))}</strong> ({emDias(diasAte(prazoResposta(p)!))}).
            </p>
            <FonteRegra regra={FONTES.resposta} />
            {fin && (
              <FormAcao action={registrarResposta} className="mt-24">
                <input type="hidden" name="pedidoId" value={p.id} />
                <h3>Registrar a resposta do órgão</h3>
                <RadiosCartao
                  nome="resultado"
                  legenda="Resultado"
                  valorInicial="DEFERIDO"
                  opcoes={[
                    { valor: "DEFERIDO", titulo: "Deferido", descricao: "O órgão aceitou, no todo ou em parte." },
                    { valor: "INDEFERIDO", titulo: "Indeferido", descricao: "O órgão negou o pedido." },
                  ]}
                />
                <div className="linha-form">
                  <CampoData nome="respostaData" id="respostaData" rotulo="Data da resposta" valorInicial={hoje} mostrarRelativo={false} />
                  <CampoDinheiro
                    nome="valorDeferido"
                    id="valorDeferido"
                    rotulo="Valor deferido"
                    valorInicial={calc.retroativo?.total}
                    ajuda="A diferença retroativa reconhecida pelo órgão. Deixe em branco se indeferido."
                  />
                </div>
                <TextoLongo nome="respostaResumo" rotulo="Resumo da resposta" opcional limite={1000} />
                <BotaoEnvio>Registrar resposta</BotaoEnvio>
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
                <dt>Valor deferido</dt>
                <dd>{reais(p.valorDeferido)}</dd>
              </div>
              <div>
                <dt>Deferido em</dt>
                <dd style={{ fontSize: 20 }}>{data(p.deferidoEm)}</dd>
              </div>
            </dl>
            {p.diferencaMensal && p.dataBase && (
              // L11: só informação, à parte; não muda o pedido protocolado nem o valor deferido
              <p className="legenda mt-8 mb-0">
                Só para informação: com a diferença de {brl(p.diferencaMensal.toString())} por mês, a diferença acumulada desde a data-base até hoje seria de{" "}
                {brl(calcularRetroativo(p.diferencaMensal.toString(), p.dataBase, hojeUTC(), p.retroMesIncompleto).total)}.
              </p>
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
                    <CampoData nome="apostiladoEm" rotulo="Data do apostilamento" valorInicial={hoje} mostrarRelativo={false} />
                    <BotaoEnvio>Registrar apostilamento</BotaoEnvio>
                  </FormAcao>
                )}
              </>
            )}
            {p.estado === "DEFERIDO" && p.apostiladoEm && fin && (
              <FormAcao action={gerarCobranca}>
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="secundario">Apostilado em {data(p.apostiladoEm)}. Emita a nota fiscal separada das diferenças retroativas e registre aqui.</p>
                <div className="linha-form">
                  <CampoTexto nome="notaFiscal" rotulo="Número da nota fiscal" largura="medio" />
                  <CampoData nome="faturadoEm" rotulo="Data da nota" valorInicial={hoje} mostrarRelativo={false} />
                </div>
                <BotaoEnvio>Gerar cobrança da diferença</BotaoEnvio>
              </FormAcao>
            )}
            {p.estado === "FATURADO" && fin && (
              <FormAcao action={marcarRecebido}>
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="secundario">
                  Nota {p.notaFiscal} emitida em {data(p.faturadoEm)}. Quando o pagamento cair, marque aqui.
                </p>
                <div className="linha-form">
                  <CampoData nome="recebidoEm" rotulo="Data do recebimento" valorInicial={hoje} mostrarRelativo={false} />
                  <CampoDinheiro nome="valorRecebido" rotulo="Valor recebido" valorInicial={p.valorDeferido?.toFixed(2)} />
                </div>
                <BotaoEnvio>Marcar como recebido</BotaoEnvio>
              </FormAcao>
            )}
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
