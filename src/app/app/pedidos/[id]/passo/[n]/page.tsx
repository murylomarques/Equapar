import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, pct } from "@/lib/calculo/motor";
import type { PlanilhaCustos } from "@/lib/calculo/tipos";
import { calcularPedido, CHECKLIST, NOME_GATILHO, situacaoChecklist } from "@/lib/pedido";
import { data, MESES, paraInputData, hojeUTC, dataLocal } from "@/lib/format";
import { FONTES } from "@/lib/prazos";
import { iaAtiva } from "@/lib/ia";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FonteRegra } from "@/components/fonte-regra";
import { SeloSimples } from "@/components/selo";
import { CabecalhoPedido } from "../../cabecalho";
import { EditorPlanilha } from "../../../editor-planilha";
import { ZonaArquivo } from "../../../zona-arquivo";
import {
  anexarDocumentoPedido,
  concluirPasso2,
  concluirPasso3,
  concluirPasso4,
  descartarPedido,
  enviarPlanilha,
  gerarPedido,
  marcarItem,
  salvarPasso1,
  usarModelo,
} from "../../../acoes";
import type { LinhaNaoLida } from "@/lib/planilha-import";

export const metadata: Metadata = { title: "Pedido de repactuação | Equapar" };

export default async function Passo({ params }: { params: Promise<{ id: string; n: string }> }) {
  const ctx = await contexto();
  const { id, n: nTxt } = await params;
  const n = Number(nTxt);
  if (!(n >= 1 && n <= 5)) notFound();
  const p = await pedidoDaConta(ctx, id);
  if (!["EM_ANALISE", "CALCULO_VALIDADO"].includes(p.estado)) redirect(`/app/pedidos/${p.id}/pronto`);
  if (n > p.passoAtual) redirect(`/app/pedidos/${p.id}/passo/${p.passoAtual}`);
  const leitura = !pode(ctx.papel, "editar_pedidos");

  return (
    <>
      <CabecalhoPedido pedido={p} passo={n} />
      <div className="passo-conteudo">
        {n === 1 && <Passo1 p={p} contaId={ctx.conta.id} leitura={leitura} />}
        {n === 2 && <Passo2 p={p} leitura={leitura} />}
        {n === 3 && <Passo3 p={p} leitura={leitura} />}
        {n === 4 && <Passo4 p={p} leitura={leitura} />}
        {n === 5 && <Passo5 p={p} leitura={leitura} podeAprovar={pode(ctx.papel, "aprovar_memoria")} />}
      </div>
      {!leitura && n === 1 && (
        <FormAcao action={descartarPedido} confirmar="Descartar este pedido? O que foi preenchido será apagado." className="mt-24">
          <input type="hidden" name="pedidoId" value={p.id} />
          <button className="btn btn-texto" type="submit">
            Descartar pedido
          </button>
        </FormAcao>
      )}
    </>
  );
}

type P = Awaited<ReturnType<typeof pedidoDaConta>>;

function Rodape({ voltar, continuar = "Continuar", leitura }: { voltar?: string; continuar?: string; leitura: boolean }) {
  return (
    <div className="rodape-assistente">
      {voltar ? (
        <Link href={voltar} className="btn">
          Voltar
        </Link>
      ) : (
        <span />
      )}
      {!leitura && <BotaoEnvio pendente="Conferindo…">{continuar}</BotaoEnvio>}
    </div>
  );
}

async function Passo1({ p, contaId, leitura }: { p: P; contaId: string; leitura: boolean }) {
  const convs = await db.convencao.findMany({ where: { contaId }, orderBy: { ano: "desc" } });
  return (
    <div className="cartao" style={{ maxWidth: 760 }}>
      <h2>O que mudou?</h2>
      <FormAcao action={salvarPasso1}>
        <input type="hidden" name="pedidoId" value={p.id} />
        <fieldset disabled={leitura} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="pilha-8" style={{ marginBottom: 16 }}>
            {(Object.keys(NOME_GATILHO) as (keyof typeof NOME_GATILHO)[]).map((g) => (
              <label key={g} className="check">
                <input type="radio" name="gatilho" value={g} defaultChecked={p.gatilho === g} /> {NOME_GATILHO[g]}
              </label>
            ))}
          </div>
          <div className="campo">
            <label htmlFor="convencaoId">Convenção</label>
            <select id="convencaoId" name="convencaoId" defaultValue={p.convencaoId ?? p.contrato.convencaoId ?? ""}>
              <option value="">Escolha</option>
              {convs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · data-base {MESES[c.mesDataBase - 1]}
                </option>
              ))}
            </select>
            <span className="ajuda">
              Não está na lista? <Link href="/app/convencoes">Cadastre a convenção nova</Link>.
            </span>
          </div>
          <div className="linha-form">
            <div className="campo">
              <label htmlFor="dataBase">Data-base (início dos efeitos)</label>
              <input id="dataBase" name="dataBase" type="date" defaultValue={paraInputData(p.dataBase)} />
            </div>
            <div className="campo">
              <label htmlFor="dataDeposito">Data do depósito da convenção</label>
              <input id="dataDeposito" name="dataDeposito" type="date" defaultValue={paraInputData(p.dataDeposito ?? p.convencao?.dataDeposito)} aria-describedby="ajuda-deposito" />
              <span id="ajuda-deposito" className="ajuda">
                A convenção precisa estar depositada no Ministério do Trabalho, pelo sistema Mediador.
              </span>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="descricaoGatilho">Descrição (obrigatória em &ldquo;Outro custo&rdquo;)</label>
            <textarea id="descricaoGatilho" name="descricaoGatilho" defaultValue={p.descricaoGatilho ?? ""} style={{ minHeight: 64 }} />
          </div>
        </fieldset>
        <Rodape leitura={leitura} />
      </FormAcao>
    </div>
  );
}

function Passo2({ p, leitura }: { p: P; leitura: boolean }) {
  const naoLidas = (p.linhasNaoLidas as LinhaNaoLida[] | null) ?? [];
  return (
    <div className="pilha">
      {!leitura && (
        <div className="grade-2">
          <ZonaArquivo
            action={enviarPlanilha}
            pedidoId={p.id}
            accept=".xlsx,.pdf"
            texto={`Arraste a planilha de custos da proposta ou do último apostilamento (Excel${iaAtiva() ? " ou PDF" : ""}).`}
          />
          <div className="cartao">
            <h2>Sem a planilha em arquivo?</h2>
            <p className="secundario">Comece do modelo da IN 05/2017 e digite os números da proposta. Nenhum valor vem preenchido.</p>
            <FormAcao action={usarModelo} confirmar={p.planilhaAntes ? "Trocar a planilha atual pelo modelo em branco?" : undefined}>
              <input type="hidden" name="pedidoId" value={p.id} />
              <BotaoEnvio className="btn">Começar do modelo em branco</BotaoEnvio>
            </FormAcao>
          </div>
        </div>
      )}
      {naoLidas.length > 0 && (
        <div className="aviso-caixa">
          <strong>Confira as {naoLidas.length} linhas que não entendemos</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {naoLidas.map((l) => (
              <li key={l.id}>
                {l.posto !== "—" && <span className="legenda">{l.posto} · </span>}
                {l.texto}
                {l.numero ? ` (${l.numero.replace(".", ",")})` : ""}: <em>{l.motivo}</em>
              </li>
            ))}
          </ul>
          <p className="legenda mb-0">Inclua ou corrija essas linhas na planilha abaixo. Elas somem quando você continuar.</p>
        </div>
      )}
      {p.planilhaAntes ? (
        <>
          <h2 className="mb-0">Planilha atual</h2>
          <EditorPlanilha key={p.atualizadoEm.getTime()} pedidoId={p.id} qual="antes" inicial={p.planilhaAntes as unknown as PlanilhaCustos} somenteLeitura={leitura} />
        </>
      ) : (
        <p className="secundario">Envie a planilha ou comece do modelo para continuar.</p>
      )}
      <FormAcao action={concluirPasso2}>
        <input type="hidden" name="pedidoId" value={p.id} />
        <Rodape voltar={`/app/pedidos/${p.id}/passo/1`} leitura={leitura} />
      </FormAcao>
    </div>
  );
}

function Passo3({ p, leitura }: { p: P; leitura: boolean }) {
  if (!p.planilhaAntes || !p.planilhaAgora) redirect(`/app/pedidos/${p.id}/passo/2`);
  return (
    <div className="pilha">
      <p className="secundario mb-0 leitura">
        Atualize pisos, benefícios e encargos com os números da convenção nova e informe a cláusula de cada um em &ldquo;Fonte&rdquo;. A memória ao lado mostra cada conta.
      </p>
      <EditorPlanilha
        key={p.atualizadoEm.getTime()}
        pedidoId={p.id}
        qual="agora"
        inicial={p.planilhaAgora as unknown as PlanilhaCustos}
        antes={p.planilhaAntes as unknown as PlanilhaCustos}
        dataBase={p.dataBase ? paraInputData(p.dataBase) : null}
        dataReferenciaInicial={paraInputData(p.dataReferencia ?? hojeUTC())}
        somenteLeitura={leitura}
      />
      <FormAcao action={concluirPasso3} id="form-passo3">
        <input type="hidden" name="pedidoId" value={p.id} />
        <Rodape voltar={`/app/pedidos/${p.id}/passo/2`} leitura={leitura} />
      </FormAcao>
    </div>
  );
}

const TIPO_DOC: Record<string, string> = { planilha_atual: "PLANILHA", convencao_nova: "CONVENCAO", convencao_anterior: "CONVENCAO", folha: "OUTRO", contrato: "CONTRATO" };

async function Passo4({ p, leitura }: { p: P; leitura: boolean }) {
  const docs = await db.documento.findMany({ where: { pedidoId: p.id }, orderBy: { criadoEm: "desc" } });
  const itens = situacaoChecklist(p, docs);
  return (
    <div className="pilha" style={{ maxWidth: 900 }}>
      <div className="cartao">
        <h2>Documentos que o órgão vai pedir</h2>
        <FonteRegra regra={FONTES.analitica} />
        <ul className="lista-limpa pilha-8 mt-16">
          {itens.map((i) => (
            <li key={i.id} className="item-acao" style={{ borderLeftColor: i.situacao === "FALTA" ? "var(--carimbo)" : i.situacao === "ANEXADO" ? "var(--verde)" : "var(--linha)" }}>
              <div>
                {i.nome}
                <div style={{ marginTop: 4 }}>
                  <SeloSimples
                    texto={i.situacao === "ANEXADO" ? "Anexado" : i.situacao === "FALTA" ? "Falta" : "Opcional"}
                    tom={i.situacao === "ANEXADO" ? "verde" : i.situacao === "FALTA" ? "carimbo" : "neutro"}
                    icone={i.situacao === "ANEXADO" ? "check" : i.situacao === "FALTA" ? "alerta" : "relogio"}
                  />
                </div>
              </div>
              {!leitura && !("automatico" in i && i.automatico) && (
                <div className="fileira">
                  <FormAcao action={anexarDocumentoPedido} className="fileira">
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <input type="hidden" name="item" value={i.id} />
                    <input type="hidden" name="tipo" value={TIPO_DOC[i.id] ?? "OUTRO"} />
                    <label className="sr-only" htmlFor={`arq-${i.id}`}>
                      Arquivo para {i.nome}
                    </label>
                    <input id={`arq-${i.id}`} type="file" name="arquivo" accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg" style={{ maxWidth: 220, fontSize: 13 }} />
                    <BotaoEnvio className="btn btn-pequeno" pendente="Enviando…">
                      Anexar
                    </BotaoEnvio>
                  </FormAcao>
                  {i.situacao !== "ANEXADO" && (
                    <FormAcao action={marcarItem}>
                      <input type="hidden" name="pedidoId" value={p.id} />
                      <input type="hidden" name="item" value={i.id} />
                      <input type="hidden" name="valor" value="ANEXADO" />
                      <button type="submit" className="btn btn-texto btn-pequeno">
                        Já tenho fora do sistema
                      </button>
                    </FormAcao>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      {docs.length > 0 && (
        <div className="cartao">
          <h2>Anexos deste pedido</h2>
          <ul className="lista-limpa pilha-8">
            {docs.map((d) => (
              <li key={d.id} className="entre" style={{ fontSize: 14 }}>
                <a href={`/api/documentos/${d.id}`}>{d.nome}</a>
                <span className="legenda">{dataLocal(d.criadoEm)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormAcao action={concluirPasso4}>
        <input type="hidden" name="pedidoId" value={p.id} />
        <Rodape voltar={`/app/pedidos/${p.id}/passo/3`} leitura={leitura} />
      </FormAcao>
      <p className="legenda">{CHECKLIST.length} itens na lista. A planilha nova e a memória são geradas pela Equapar.</p>
    </div>
  );
}

function Passo5({ p, leitura, podeAprovar }: { p: P; leitura: boolean; podeAprovar: boolean }) {
  const calc = calcularPedido(p);
  const c = calc.comparacao;
  return (
    <div className="grade-2" style={{ alignItems: "start" }}>
      <div className="cartao">
        <h2>Resumo</h2>
        {c && !c.erros.length ? (
          <dl className="dl-resumo">
            <dt>Gatilho</dt>
            <dd>
              {NOME_GATILHO[p.gatilho]}
              {p.convencao ? ` · ${p.convencao.nome}` : ""}
            </dd>
            <dt>Data-base</dt>
            <dd>{data(p.dataBase)}</dd>
            <dt>Valor mensal</dt>
            <dd>
              {brl(c.mensalAntes)} → <strong>{brl(c.mensalAgora)}</strong>
            </dd>
            <dt>Diferença por mês</dt>
            <dd>
              <strong>{brl(c.diferencaMensal)}</strong> {c.variacaoPct && `(${pct(c.variacaoPct)})`}
            </dd>
            <dt>Desde a data-base</dt>
            <dd>
              <strong>{calc.retroativo ? brl(calc.retroativo.total) : "—"}</strong> até {data(calc.dataReferencia)}
            </dd>
            <dt>Memória de cálculo</dt>
            <dd>
              {p.memoriaAprovadaEm ? (
                <SeloSimples texto={`Aprovada por ${p.memoriaAprovadaPor}`} tom="verde" icone="check" />
              ) : (
                <SeloSimples texto="Aguardando aprovação de Contador ou Dono" tom="ambar" icone="relogio" />
              )}
            </dd>
          </dl>
        ) : (
          <p className="erro-texto">O cálculo tem pendências. Volte ao passo 3.</p>
        )}
        <Link href={`/app/pedidos/${p.id}/memoria`} className="btn mt-16">
          {podeAprovar && !p.memoriaAprovadaEm ? "Revisar e aprovar a memória" : "Ver a memória de cálculo"}
        </Link>
      </div>
      <div className="cartao">
        <h2>Gerar pedido</h2>
        <p className="secundario">A Equapar gera o ofício (Word e PDF), a planilha (Excel), a memória de cálculo (PDF) e um ZIP com os anexos, prontos para protocolar.</p>
        <FormAcao action={gerarPedido}>
          <input type="hidden" name="pedidoId" value={p.id} />
          <label className="check" style={{ marginBottom: 16 }}>
            <input type="checkbox" name="revisao" defaultChecked={p.revisaoEspecialista} disabled={leitura} />
            <span>
              Pedir revisão de especialista <span className="legenda">(cobrada à parte)</span>
            </span>
          </label>
          <div className="rodape-assistente">
            <Link href={`/app/pedidos/${p.id}/passo/4`} className="btn">
              Voltar
            </Link>
            {!leitura && <BotaoEnvio pendente="Gerando…">Gerar pedido</BotaoEnvio>}
          </div>
        </FormAcao>
      </div>
    </div>
  );
}
