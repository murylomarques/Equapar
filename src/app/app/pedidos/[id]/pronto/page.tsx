import type { Metadata } from "next";
import Link from "next/link";
import { FileText, FileSpreadsheet, FileArchive } from "lucide-react";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/calculo/motor";
import { calcularPedido, ESTADOS } from "@/lib/pedido";
import { data, dataHora, dataLocal, diasAte, emDias, paraInputData, hojeUTC, reais } from "@/lib/format";
import { FONTES, prazoResposta } from "@/lib/prazos";
import { Carimbo, SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FonteRegra } from "@/components/fonte-regra";
import { gerarCobranca, marcarRecebido, registrarApostilamento, registrarProtocolo, registrarResposta } from "../../acoes";

export const metadata: Metadata = { title: "Pedido pronto | Equapar" };

export default async function Pronto({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const p = await pedidoDaConta(ctx, id);
  const calc = calcularPedido(p);
  const historico = await db.historico.findMany({ where: { pedidoId: p.id }, include: { usuario: true }, orderBy: { criadoEm: "desc" } });
  const idx = ESTADOS.findIndex((e) => e.id === p.estado);
  const fin = pode(ctx.papel, "registrar_financeiro");
  const hoje = paraInputData(hojeUTC());
  const arquivos = [
    { href: "oficio.docx", nome: "Ofício (Word)", icone: FileText },
    { href: "oficio.pdf", nome: "Ofício (PDF)", icone: FileText },
    { href: "planilha.xlsx", nome: "Planilha (Excel)", icone: FileSpreadsheet },
    { href: "memoria.pdf", nome: "Memória de cálculo (PDF)", icone: FileText },
    { href: "pacote.zip", nome: "Tudo com os anexos (ZIP)", icone: FileArchive },
  ];

  if (p.estado === "EM_ANALISE")
    return (
      <div className="cartao">
        <p>Este pedido ainda está sendo montado.</p>
        <Link href={`/app/pedidos/${p.id}`} className="btn btn-primario">
          Continuar o pedido
        </Link>
      </div>
    );

  return (
    <>
      <div className="app-cab">
        <div>
          <p className="legenda mb-0">
            <Link href={`/app/contratos/${p.contrato.id}`}>
              Contrato {p.contrato.numero} · {p.contrato.orgao}
            </Link>
          </p>
          <h1>Pedido de repactuação</h1>
        </div>
        {p.estado === "CALCULO_VALIDADO" && <Carimbo texto="PRONTO PARA PROTOCOLAR" />}
        {(p.estado === "DEFERIDO" || p.estado === "FATURADO") && <Carimbo texto="DEFERIDO" />}
        {p.estado === "RECEBIDO" && <Carimbo texto="RECEBIDO" />}
        {p.estado === "INDEFERIDO" && <SeloSimples texto="Indeferido" tom="carimbo" icone="alerta" />}
      </div>

      <ol className="estados" aria-label="Estados do dinheiro">
        {ESTADOS.map((e, i) => {
          // criadoEm/geradoEm têm hora (fuso de Brasília); as demais são datas de calendário
          const datas: Record<string, string | null> = {
            EM_ANALISE: dataLocal(p.criadoEm),
            CALCULO_VALIDADO: p.geradoEm ? dataLocal(p.geradoEm) : null,
            PROTOCOLADO: p.protocoloData ? data(p.protocoloData) : null,
            DEFERIDO: p.deferidoEm ? data(p.deferidoEm) : null,
            FATURADO: p.faturadoEm ? data(p.faturadoEm) : null,
            RECEBIDO: p.recebidoEm ? data(p.recebidoEm) : null,
          };
          return (
            <li key={e.id} className={`${i <= idx ? "feito" : ""} ${i === idx ? "atual" : ""}`} aria-current={i === idx ? "step" : undefined}>
              <strong>{e.nome}</strong>
              {datas[e.id] ?? ""}
            </li>
          );
        })}
      </ol>

      <div className="grade-2 mt-24" style={{ alignItems: "start" }}>
        <div className="pilha">
          <section className="cartao" aria-labelledby="arquivos">
            <h2 id="arquivos">Arquivos</h2>
            <ul className="lista-limpa pilha-8">
              {arquivos.map((a) => (
                <li key={a.href}>
                  <a href={`/api/pedidos/${p.id}/arquivos/${a.href}`} className="fileira" style={{ fontSize: 15 }}>
                    <a.icone size={18} strokeWidth={1.5} aria-hidden /> {a.nome}
                  </a>
                </li>
              ))}
            </ul>
            <p className="legenda mt-16 mb-0">O ofício é uma minuta: revise com seu jurídico antes de protocolar.</p>
          </section>

          {calc.comparacao && !calc.comparacao.erros.length && (
            <section className="cartao" aria-labelledby="valores">
              <h2 id="valores">Valores</h2>
              <dl className="dl-resumo">
                <dt>Diferença por mês</dt>
                <dd>{brl(calc.comparacao.diferencaMensal)}</dd>
                <dt>Desde a data-base</dt>
                <dd>
                  {calc.retroativo ? brl(calc.retroativo.total) : "—"} (até {data(calc.dataReferencia)})
                </dd>
                {p.valorDeferido && (
                  <>
                    <dt>Valor deferido</dt>
                    <dd>{reais(p.valorDeferido)}</dd>
                  </>
                )}
                {p.valorRecebido && (
                  <>
                    <dt>Valor recebido</dt>
                    <dd>{reais(p.valorRecebido)}</dd>
                  </>
                )}
              </dl>
              <Link href={`/app/pedidos/${p.id}/memoria`} className="btn mt-16">
                Ver a memória de cálculo
              </Link>
            </section>
          )}
        </div>

        <div className="pilha">
          {p.estado === "CALCULO_VALIDADO" && (
            <section className="cartao" aria-labelledby="protocolar">
              <h2 id="protocolar">Protocolar</h2>
              <p>Protocole pelo canal indicado no contrato: Compras.gov.br, sistema do órgão ou e-mail do fiscal.</p>
              {fin ? (
                <FormAcao action={registrarProtocolo}>
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="protocoloNumero">Número do protocolo</label>
                      <input id="protocoloNumero" name="protocoloNumero" />
                    </div>
                    <div className="campo">
                      <label htmlFor="protocoloData">Data do protocolo</label>
                      <input id="protocoloData" name="protocoloData" type="date" defaultValue={hoje} />
                    </div>
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
          )}

          {p.estado === "PROTOCOLADO" && (
            <section className="cartao" aria-labelledby="aguardando">
              <h2 id="aguardando">Aguardando o órgão</h2>
              <p>
                Protocolo {p.protocoloNumero} em {data(p.protocoloData)}. Prazo preferencial de resposta: {data(prazoResposta(p))} ({emDias(diasAte(prazoResposta(p)!))}).
              </p>
              <FonteRegra regra={FONTES.resposta} />
              {fin && (
                <FormAcao action={registrarResposta} className="mt-16">
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
                    <legend className="rotulo" style={{ marginBottom: 8 }}>
                      Resposta do órgão
                    </legend>
                    <div className="fileira" style={{ gap: 16 }}>
                      <label className="check">
                        <input type="radio" name="resultado" value="DEFERIDO" defaultChecked /> Deferido
                      </label>
                      <label className="check">
                        <input type="radio" name="resultado" value="INDEFERIDO" /> Indeferido
                      </label>
                    </div>
                  </fieldset>
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="respostaData">Data da resposta</label>
                      <input id="respostaData" name="respostaData" type="date" defaultValue={hoje} />
                    </div>
                    <div className="campo">
                      <label htmlFor="valorDeferido">Valor deferido (R$)</label>
                      <input id="valorDeferido" name="valorDeferido" inputMode="decimal" defaultValue={calc.retroativo ? calc.retroativo.total.replace(".", ",") : ""} />
                      <span className="ajuda">A diferença retroativa reconhecida pelo órgão.</span>
                    </div>
                  </div>
                  <div className="campo">
                    <label htmlFor="respostaResumo">Resumo da resposta (opcional)</label>
                    <textarea id="respostaResumo" name="respostaResumo" style={{ minHeight: 56 }} />
                  </div>
                  <BotaoEnvio>Registrar resposta</BotaoEnvio>
                </FormAcao>
              )}
            </section>
          )}

          {(p.estado === "DEFERIDO" || p.estado === "FATURADO") && (
            <section className="cartao" aria-labelledby="receber">
              <h2 id="receber">Até o dinheiro entrar</h2>
              {p.estado === "DEFERIDO" && !p.apostiladoEm && fin && (
                <FormAcao action={registrarApostilamento}>
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <div className="campo">
                    <label htmlFor="apostiladoEm">Data do apostilamento</label>
                    <input id="apostiladoEm" name="apostiladoEm" type="date" defaultValue={hoje} />
                  </div>
                  <BotaoEnvio>Registrar apostilamento</BotaoEnvio>
                </FormAcao>
              )}
              {p.estado === "DEFERIDO" && p.apostiladoEm && fin && (
                <FormAcao action={gerarCobranca}>
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <p className="secundario">Apostilado em {data(p.apostiladoEm)}. Emita a nota fiscal separada das diferenças retroativas.</p>
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="notaFiscal">Número da nota fiscal</label>
                      <input id="notaFiscal" name="notaFiscal" />
                    </div>
                    <div className="campo">
                      <label htmlFor="faturadoEm">Data</label>
                      <input id="faturadoEm" name="faturadoEm" type="date" defaultValue={hoje} />
                    </div>
                  </div>
                  <BotaoEnvio>Gerar cobrança da diferença</BotaoEnvio>
                </FormAcao>
              )}
              {p.estado === "FATURADO" && fin && (
                <FormAcao action={marcarRecebido}>
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <p className="secundario">
                    NF {p.notaFiscal} emitida em {data(p.faturadoEm)}.
                  </p>
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="recebidoEm">Data do recebimento</label>
                      <input id="recebidoEm" name="recebidoEm" type="date" defaultValue={hoje} />
                    </div>
                    <div className="campo">
                      <label htmlFor="valorRecebido">Valor recebido (R$)</label>
                      <input id="valorRecebido" name="valorRecebido" inputMode="decimal" defaultValue={p.valorDeferido ? String(p.valorDeferido).replace(".", ",") : ""} />
                    </div>
                  </div>
                  <BotaoEnvio>Marcar como recebido</BotaoEnvio>
                </FormAcao>
              )}
              {!fin && <p className="legenda">Dono ou Gerente de contratos registram estas etapas.</p>}
            </section>
          )}

          {p.estado === "INDEFERIDO" && (
            <section className="cartao">
              <h2>Indeferido em {data(p.respostaData)}</h2>
              {p.respostaResumo && <p>{p.respostaResumo}</p>}
              <p className="secundario">Se o pedido foi negado por falta de prova, revise os documentos e a memória com um especialista antes de um novo pedido ou recurso.</p>
            </section>
          )}

          <section className="cartao" aria-labelledby="hist">
            <h2 id="hist">Histórico</h2>
            <ul className="lista-limpa pilha-8">
              {historico.map((h) => (
                <li key={h.id} style={{ fontSize: 14 }}>
                  <span className="legenda">{dataHora(h.criadoEm)}</span> · {h.usuario?.nome ?? "Sistema"} · {h.acao}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
