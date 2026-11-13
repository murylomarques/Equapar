import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, FileText } from "lucide-react";
import { contexto, pedidoDaConta, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, pct } from "@/lib/calculo/motor";
import type { PlanilhaCustos } from "@/lib/calculo/tipos";
import { calcularPedido, NOME_GATILHO, situacaoChecklist } from "@/lib/pedido";
import { data, dataLocal, paraInputData, hojeUTC, plural } from "@/lib/format";
import { FONTES } from "@/lib/prazos";
import { iaAtiva } from "@/lib/ia";
import { convencoesParaForm } from "@/lib/dto";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { FonteRegra } from "@/components/fonte-regra";
import { SeloSimples } from "@/components/selo";
import { AreaArquivo } from "@/components/ui/arquivo";
import { CampoData, CampoInteiro, CampoSelect, Combobox, RadiosCartao, TextoLongo } from "@/components/ui/campos";
import { JORNADA, empregadosPorPosto, horasReduzidas, planilhaDoCenario, type Cenario } from "@/lib/jornada";
import { Alerta, Termo } from "@/components/ui/estrutura";
import { aprovacaoValida } from "@/lib/pedido-regras";
import { NOME_CONTAR_ATE, NOME_MES_INCOMPLETO } from "@/lib/pedido";
import { CabecalhoPedido } from "../../cabecalho";
import { EditorPlanilha } from "../../../editor-planilha";
import { anexarDocumentoPedido, concluirPasso2, concluirPasso3, concluirPasso4, enviarPlanilha, gerarPedido, marcarItem, salvarPasso1, usarModelo } from "../../../acoes";
import type { LinhaNaoLida } from "@/lib/planilha-import";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { DICAS_PASSO, mostrarDica } from "@/lib/dicas";
import { dispensarDica } from "../../../../acoes";
import { Lightbulb } from "lucide-react";

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
      <CabecalhoPedido pedido={p} passo={n} podeEditar={!leitura} />
      {leitura && (
        <Alerta tipo="info" className="mb-16">
          Seu papel é só de leitura: você vê o pedido, mas não altera.
        </Alerta>
      )}
      <DicaPasso contaId={ctx.conta.id} dispensadas={ctx.conta.dicasDispensadas} passo={n} />
      <div className="passo-conteudo">
        {n === 1 && <Passo1 p={p} contaId={ctx.conta.id} leitura={leitura} />}
        {n === 2 && <Passo2 p={p} leitura={leitura} />}
        {n === 3 && <Passo3 p={p} leitura={leitura} />}
        {n === 4 && <Passo4 p={p} leitura={leitura} />}
        {n === 5 && <Passo5 p={p} leitura={leitura} podeAprovar={pode(ctx.papel, "aprovar_memoria")} />}
      </div>
    </>
  );
}

type P = Awaited<ReturnType<typeof pedidoDaConta>>;

/** 5.4: dica curta do passo no primeiro pedido da conta, com o pedido de exemplo ao lado. */
async function DicaPasso({ contaId, dispensadas, passo }: { contaId: string; dispensadas: unknown; passo: number }) {
  const gerados = await db.pedido.count({ where: { contrato: { empresa: { contaId } }, geradoEm: { not: null } } });
  if (!mostrarDica(passo, gerados, dispensadas)) return null;
  return (
    <div className="dica-passo" role="note" aria-label="Dica do passo">
      <Lightbulb size={18} strokeWidth={1.5} aria-hidden />
      <p className="mb-0">
        {DICAS_PASSO[passo]}{" "}
        <a href="/app/pedido-exemplo" target="_blank" rel="noopener">
          Ver um pedido pronto de exemplo
        </a>
      </p>
      <FormAcao action={dispensarDica} semToast>
        <input type="hidden" name="passo" value={passo} />
        <BotaoEnvio className="btn btn-discreto btn-pequeno" pendente="Dispensando…">
          Entendi, não mostrar mais
        </BotaoEnvio>
      </FormAcao>
    </div>
  );
}

function Rodape({ voltar, continuar = "Continuar", leitura, salvandoAntes }: { voltar?: string; continuar?: string; leitura: boolean; salvandoAntes?: boolean }) {
  return (
    <div className="rodape-assistente">
      {voltar ? (
        <Link href={voltar} className="btn">
          Voltar
        </Link>
      ) : (
        <span />
      )}
      {!leitura && <BotaoEnvio pendente={salvandoAntes ? "Salvando…" : undefined}>{continuar}</BotaoEnvio>}
    </div>
  );
}

async function Passo1({ p, contaId, leitura }: { p: P; contaId: string; leitura: boolean }) {
  const convs = await db.convencao.findMany({ where: { contaId }, orderBy: { ano: "desc" } });
  const usamConvencao = p.convencaoId ? await db.contrato.count({ where: { convencaoId: p.convencaoId } }) : 0;
  return (
    <div className="cartao" style={{ maxWidth: 760 }}>
      <h2>O que mudou?</h2>
      <FormAcao action={salvarPasso1} semToast className="form-passo1">
        <input type="hidden" name="pedidoId" value={p.id} />
        <fieldset disabled={leitura} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <RadiosCartao
            nome="gatilho"
            legenda="Motivo do pedido"
            valorInicial={p.gatilho}
            opcoes={[
              { valor: "NOVA_CONVENCAO", titulo: NOME_GATILHO.NOVA_CONVENCAO, descricao: "O caso mais comum: novos pisos e benefícios da categoria." },
              { valor: "ACORDO_DISSIDIO", titulo: NOME_GATILHO.ACORDO_DISSIDIO, descricao: "Acordo coletivo ou sentença de dissídio." },
              { valor: "OUTRO_CUSTO", titulo: NOME_GATILHO.OUTRO_CUSTO, descricao: "Outra mudança de custo que precisa ser explicada." },
              { valor: "JORNADA_EC141", titulo: NOME_GATILHO.JORNADA_EC141, descricao: "Redução da jornada semanal para 42 e depois 40 horas. Pedido de reequilíbrio por aditivo." },
            ]}
          />
          <fieldset className="so-jornada" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="rotulo">Dados da jornada</legend>
            {!JORNADA.confirmado() && (
              <Alerta tipo="atencao" className="mb-16">
                Datas e prazos da EC 141/2026 a confirmar com o jurídico. Padrões usados: 42 horas a partir de {data(JORNADA.inicio42())}, 40 horas a partir de {data(JORNADA.inicio40())}.{" "}
                <a href={JORNADA.fonte.url} target="_blank" rel="noreferrer">
                  Fonte
                </a>
              </Alerta>
            )}
            <div className="linha-form">
              <CampoInteiro nome="jornadaAntes" rotulo="Jornada atual (horas por semana)" valorInicial={p.jornadaAntes ?? 44} />
              <CampoSelect
                nome="jornadaDepois"
                rotulo="Nova jornada"
                valorInicial={p.jornadaDepois ? String(p.jornadaDepois) : "42"}
                opcoes={[
                  { valor: "42", rotulo: "42 horas por semana" },
                  { valor: "40", rotulo: "40 horas por semana" },
                ]}
              />
            </div>
            <div className="linha-form">
              <CampoInteiro
                nome="horasCobertura"
                rotulo="Horas de cobertura por posto (por semana)"
                valorInicial={p.horasCobertura != null ? Number(p.horasCobertura) : 44}
                ajuda="Quantas horas por semana o contrato exige em cada posto."
              />
              <CampoData
                nome="inicioJornada"
                rotulo="Início da nova jornada"
                valorInicial={paraInputData(p.inicioJornada ?? JORNADA.inicio42())}
                mostrarRelativo={false}
                ajuda="A diferença conta a partir desta data."
              />
            </div>
          </fieldset>
          <div className="so-convencao">
          <Combobox
            nome="convencaoId"
            rotulo="Convenção coletiva"
            valorInicial={p.convencaoId ?? p.contrato.convencaoId}
            opcoes={convencoesParaForm(convs).map((c) => ({ valor: c.id, rotulo: c.nome, detalhe: c.detalhe }))}
            vazio="Nenhuma convenção com esse nome."
            ajuda={
              <>
                Não está na lista? <Link href="/app/convencoes">Cadastre a convenção nova</Link>.
              </>
            }
          />
          <div className="linha-form">
            <CampoData
              nome="dataBase"
              rotulo="Data-base"
              valorInicial={p.dataBase ? paraInputData(p.dataBase) : null}
              mostrarRelativo={false}
              ajuda="Início dos efeitos financeiros: a diferença conta a partir dela."
            />
            <CampoData
              nome="dataDeposito"
              rotulo="Data do depósito da convenção"
              valorInicial={p.dataDeposito ? paraInputData(p.dataDeposito) : p.convencao?.dataDeposito ? paraInputData(p.convencao.dataDeposito) : null}
              mostrarRelativo={false}
              ajuda="A convenção precisa estar depositada no Ministério do Trabalho, pelo sistema Mediador."
            />
          </div>
          {p.convencao?.dataDeposito && (
            <label className="check mb-16">
              <input type="checkbox" name="atualizarConvencao" disabled={leitura} />
              <span>
                Se a data de depósito for diferente da registrada na convenção ({data(p.convencao.dataDeposito)}), atualizar também a convenção para {plural(usamConvencao, "o contrato que a usa", `os ${usamConvencao} contratos que a usam`, false)}
                <span className="ajuda-texto" style={{ display: "block" }}>
                  Sem marcar, a data fica só neste pedido.
                </span>
              </span>
            </label>
          )}
          </div>
          <TextoLongo nome="descricaoGatilho" rotulo="Descrição" opcional valorInicial={p.descricaoGatilho} limite={500} ajuda="Obrigatória quando o motivo for “Outro custo”." />
        </fieldset>
        <Rodape leitura={leitura} />
      </FormAcao>
    </div>
  );
}

const AVISO_REFAZER = "A planilha nova do passo 3 será refeita a partir desta. As alterações do passo 3 serão perdidas.";

function Passo2({ p, leitura }: { p: P; leitura: boolean }) {
  const naoLidas = (p.linhasNaoLidas as LinhaNaoLida[] | null) ?? [];
  // C1: trocar a planilha atual refaz a planilha nova do passo 3
  const temNova = !!p.planilhaAgora;
  const refazer = temNova ? { titulo: "Trocar a planilha atual?", texto: AVISO_REFAZER, confirmar: "Trocar e refazer o passo 3", perigo: true } : undefined;
  return (
    <div className="pilha" style={{ gap: 24 }}>
      {temNova && !leitura && (
        <Alerta tipo="atencao" titulo="Este pedido já tem a planilha nova do passo 3">
          Se você trocar a planilha atual, a planilha nova será refeita a partir dela e as alterações do passo 3 serão perdidas.{" "}
          <a href={`/api/pedidos/${p.id}/arquivos/planilha.xlsx`}>Baixar a planilha nova antes (Excel)</a>
        </Alerta>
      )}
      {!leitura && (
        <div className="grade-2">
          <div className="cartao">
            <h2>Planilha de custos atual</h2>
            <p className="secundario">A da proposta ou a do último apostilamento. A Equapar lê as linhas e pede confirmação só do que não entendeu.</p>
            <FormAcao action={enviarPlanilha} confirmar={refazer}>
              <input type="hidden" name="pedidoId" value={p.id} />
              {temNova && <input type="hidden" name="refazerPlanilhaNova" value="1" />}
              <AreaArquivo tipos={iaAtiva() ? ["excel", "pdf"] : ["excel"]} enviarAoEscolher textoEnviando="Lendo a planilha…" />
            </FormAcao>
          </div>
          <div className="cartao">
            <h2>Sem a planilha em arquivo?</h2>
            <p className="secundario">Comece do modelo da IN 05/2017 e digite os números da proposta. Nenhum valor vem preenchido.</p>
            <FormAcao
              action={usarModelo}
              confirmar={
                p.planilhaAntes
                  ? {
                      titulo: "Trocar a planilha atual pelo modelo em branco?",
                      texto: temNova ? `As linhas digitadas até agora serão substituídas. ${AVISO_REFAZER}` : "As linhas digitadas até agora serão substituídas.",
                      confirmar: "Usar o modelo",
                      perigo: true,
                    }
                  : undefined
              }
            >
              <input type="hidden" name="pedidoId" value={p.id} />
              {temNova && <input type="hidden" name="refazerPlanilhaNova" value="1" />}
              <BotaoEnvio className="btn">Começar do modelo em branco</BotaoEnvio>
            </FormAcao>
          </div>
        </div>
      )}
      {naoLidas.length > 0 && (
        <Alerta tipo="atencao" titulo={naoLidas.length === 1 ? "Confira a linha que não entendemos" : `Confira as ${naoLidas.length} linhas que não entendemos`}>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {naoLidas.map((l) => (
              <li key={l.id}>
                <mark>{l.texto}</mark>
                {l.numero ? ` (${l.numero.replace(".", ",")})` : ""} · {l.motivo}
                {l.posto !== "—" && <span className="legenda"> · {l.posto}</span>}
              </li>
            ))}
          </ul>
          <p className="legenda mb-0 mt-8">Inclua ou corrija essas linhas na planilha abaixo. O aviso some quando você continuar.</p>
        </Alerta>
      )}
      {p.planilhaAntes ? (
        <EditorPlanilha key={p.atualizadoEm.getTime()} pedidoId={p.id} qual="antes" inicial={p.planilhaAntes as unknown as PlanilhaCustos} somenteLeitura={leitura} />
      ) : (
        <p className="secundario">Envie a planilha ou comece do modelo para continuar.</p>
      )}
      <FormAcao action={concluirPasso2} semToast esperarSalvamento>
        <input type="hidden" name="pedidoId" value={p.id} />
        <Rodape voltar={`/app/pedidos/${p.id}/passo/1`} leitura={leitura} salvandoAntes />
      </FormAcao>
    </div>
  );
}

function CenariosJornada({ p, leitura }: { p: P; leitura: boolean }) {
  const antes = p.jornadaAntes ?? 44;
  const depois = p.jornadaDepois ?? 42;
  const cobertura = Number(p.horasCobertura ?? 44);
  const atual = p.planilhaAntes as unknown as PlanilhaCustos;
  const ref = p.dataReferencia ?? hojeUTC();
  const cen = (c: Cenario) => calcularPedido({ ...p, dataReferencia: ref, planilhaAgora: planilhaDoCenario(atual, c, antes, depois) as never });
  const manter = cen("MANTER_HORAS");
  const reduzir = cen("REDUZIR_HORAS");
  const linha = (rot: string, v: React.ReactNode) => (
    <div className="entre">
      <span className="secundario">{rot}</span>
      <strong className="num">{v}</strong>
    </div>
  );
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={leitura}>
      <legend className="rotulo mb-8">Escolha o cenário deste pedido (nenhum vem marcado)</legend>
      <div className="grade-2">
        <label className="cartao radio-cartao" style={{ display: "block" }}>
          <span className="entre">
            <strong>Manter as horas de serviço</strong>
            <input type="radio" name="cenarioJornada" value="MANTER_HORAS" form="form-passo3" defaultChecked={p.cenarioJornada === "MANTER_HORAS"} required />
          </span>
          <span className="ajuda-texto" style={{ display: "block" }}>
            O órgão continua recebendo {cobertura} horas por semana em cada posto. Empregados por posto: {empregadosPorPosto(cobertura, antes).toString().replace(".", ",")} → {empregadosPorPosto(cobertura, depois).toString().replace(".", ",")}.
          </span>
          <div className="pilha mt-8" style={{ gap: 4 }}>
            {linha("Valor mensal hoje", brl(manter.comparacao?.mensalAntes ?? "0"))}
            {linha("Valor mensal novo", brl(manter.comparacao?.mensalAgora ?? "0"))}
            {linha("Diferença por mês", brl(manter.comparacao?.diferencaMensal ?? "0"))}
            {manter.retroativo && linha("Diferença acumulada", brl(manter.retroativo.total))}
          </div>
        </label>
        <label className="cartao radio-cartao" style={{ display: "block" }}>
          <span className="entre">
            <strong>Reduzir as horas de serviço</strong>
            <input type="radio" name="cenarioJornada" value="REDUZIR_HORAS" form="form-passo3" defaultChecked={p.cenarioJornada === "REDUZIR_HORAS"} required />
          </span>
          <span className="ajuda-texto" style={{ display: "block" }}>
            O valor mensal não muda. O órgão passa a receber {horasReduzidas(cobertura, antes, depois).toString().replace(".", ",")} horas por semana em cada posto, no lugar de {cobertura}. O aditivo registra a redução.
          </span>
          <div className="pilha mt-8" style={{ gap: 4 }}>
            {linha("Valor mensal hoje", brl(reduzir.comparacao?.mensalAntes ?? "0"))}
            {linha("Valor mensal novo", brl(reduzir.comparacao?.mensalAgora ?? "0"))}
            {linha("Diferença por mês", brl(reduzir.comparacao?.diferencaMensal ?? "0"))}
          </div>
        </label>
      </div>
      <p className="legenda mt-8 mb-0">
        Manter as horas: as linhas em reais da planilha atual são multiplicadas por {antes} ÷ {depois}; percentuais e tributos acompanham. Regra nova, a confirmar com o jurídico.{" "}
        <a href={JORNADA.fonte.url} target="_blank" rel="noreferrer">
          Fonte
        </a>
      </p>
    </fieldset>
  );
}

function Passo3({ p, leitura }: { p: P; leitura: boolean }) {
  if (!p.planilhaAntes || !p.planilhaAgora) redirect(`/app/pedidos/${p.id}/passo/2`);
  if (p.gatilho === "JORNADA_EC141")
    return (
      <div className="pilha" style={{ gap: 16 }}>
        <p className="secundario mb-0 leitura">
          Jornada de {p.jornadaAntes} para {p.jornadaDepois} horas por semana. Compare os dois cenários e escolha um. A planilha nova é montada a partir da escolha.
        </p>
        <CenariosJornada p={p} leitura={leitura} />
        <FormAcao action={concluirPasso3} id="form-passo3" semToast>
          <input type="hidden" name="pedidoId" value={p.id} />
          <input type="hidden" name="dataReferencia" value={paraInputData(p.dataReferencia ?? hojeUTC())} />
          <Rodape voltar={`/app/pedidos/${p.id}/passo/2`} leitura={leitura} />
        </FormAcao>
      </div>
    );
  return (
    <div className="pilha" style={{ gap: 16 }}>
      <p className="secundario mb-0 leitura">
        Atualize pisos, benefícios e encargos com os números da convenção nova. Em cada linha alterada, informe a fonte (a cláusula). A memória ao lado mostra cada conta.
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
        formReferencia="form-passo3"
      />
      <FormAcao action={concluirPasso3} id="form-passo3" semToast esperarSalvamento>
        <input type="hidden" name="pedidoId" value={p.id} />
        <details className="cartao mb-16">
          <summary style={{ cursor: "pointer" }}>
            Regra da diferença retroativa: contada até {NOME_CONTAR_ATE[p.retroContarAte]}, mês incompleto por {NOME_MES_INCOMPLETO[p.retroMesIncompleto]}
          </summary>
          <p className="ajuda-texto mt-8">O padrão é o usado até hoje. Mude só se o seu jurídico orientar; a regra escolhida aparece na memória e no ofício.</p>
          <div className="linha-form">
            <CampoSelect
              nome="retroContarAte"
              rotulo="Data final da contagem"
              valorInicial={p.retroContarAte}
              opcoes={[
                { valor: "DATA_INFORMADA", rotulo: "A data informada acima (padrão)" },
                { valor: "DATA_PROTOCOLO", rotulo: "A data do protocolo" },
                { valor: "DATA_APOSTILAMENTO", rotulo: "A data do apostilamento" },
              ]}
            />
            <CampoSelect
              nome="retroMesIncompleto"
              rotulo="Mês incompleto"
              valorInicial={p.retroMesIncompleto}
              opcoes={[
                { valor: "DIAS_CORRIDOS", rotulo: "Dias corridos do mês (padrão)" },
                { valor: "MES_30_DIAS", rotulo: "Mês de 30 dias" },
              ]}
            />
          </div>
          <p className="legenda mb-0">Enquanto o protocolo ou o apostilamento não acontecem, vale a data informada.</p>
        </details>
        <Rodape voltar={`/app/pedidos/${p.id}/passo/2`} leitura={leitura} salvandoAntes />
      </FormAcao>
    </div>
  );
}

const TIPO_DOC: Record<string, string> = { planilha_atual: "PLANILHA", convencao_nova: "CONVENCAO", convencao_anterior: "CONVENCAO", folha: "OUTRO", contrato: "CONTRATO" };
const MOTIVO_DOC: Record<string, string> = {
  planilha_atual: "Mostra os custos de partida. É a base da comparação.",
  planilha_nova: "Mostra os custos novos, montada pela Equapar no passo 3.",
  memoria: "A demonstração analítica que a lei exige, linha a linha.",
  convencao_nova: "Prova o novo piso e os benefícios. O órgão confere o registro.",
  convencao_anterior: "Ajuda o órgão a comparar com a convenção da proposta.",
  folha: "Reforça que o novo piso já está sendo pago.",
  contrato: "Facilita a conferência das cláusulas e dos aditivos.",
};

async function Passo4({ p, leitura }: { p: P; leitura: boolean }) {
  const docs = await db.documento.findMany({ where: { pedidoId: p.id }, orderBy: { criadoEm: "desc" } });
  const itens = situacaoChecklist(p, docs);
  const faltam = itens.filter((i) => i.situacao === "FALTA").length;
  return (
    <div className="pilha" style={{ maxWidth: 900, gap: 16 }}>
      <div className="cartao">
        <div className="cartao-cab">
          <h2>Documentos que o órgão vai pedir</h2>
          {faltam ? <SeloSimples texto={`Faltam ${faltam}`} tom="carimbo" icone="alerta" /> : <SeloSimples texto="Tudo pronto" tom="verde" icone="check" />}
        </div>
        <FonteRegra regra={FONTES.analitica} />
        <ul className="lista-limpa mt-16">
          {itens.map((i) => (
            <li key={i.id} className="item-doc">
              <div className="entre" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontWeight: 500 }}>{i.nome}</strong>
                  <span className="ajuda-texto" style={{ display: "block" }}>
                    {MOTIVO_DOC[i.id]}
                  </span>
                </div>
                <SeloSimples
                  texto={i.situacao === "ANEXADO" ? "Anexado" : i.situacao === "FALTA" ? "Falta" : "Opcional"}
                  tom={i.situacao === "ANEXADO" ? "verde" : i.situacao === "FALTA" ? "carimbo" : "neutro"}
                  icone={i.situacao === "ANEXADO" ? "check" : i.situacao === "FALTA" ? "alerta" : "relogio"}
                />
              </div>
              {!leitura && !("automatico" in i && i.automatico) && i.situacao !== "ANEXADO" && (
                <div className="grade-2 mt-8" style={{ alignItems: "center" }}>
                  <FormAcao action={anexarDocumentoPedido}>
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <input type="hidden" name="item" value={i.id} />
                    <input type="hidden" name="tipo" value={TIPO_DOC[i.id] ?? "OUTRO"} />
                    <AreaArquivo compacta enviarAoEscolher tipos={["pdf", "excel", "word", "imagem"]} />
                  </FormAcao>
                  <FormAcao action={marcarItem} semToast>
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <input type="hidden" name="item" value={i.id} />
                    <input type="hidden" name="valor" value="ANEXADO" />
                    <BotaoEnvio className="btn btn-discreto">Já tenho fora do sistema</BotaoEnvio>
                  </FormAcao>
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
      <FormAcao action={concluirPasso4} semToast>
        <input type="hidden" name="pedidoId" value={p.id} />
        <Rodape voltar={`/app/pedidos/${p.id}/passo/3`} leitura={leitura} />
      </FormAcao>
    </div>
  );
}

function Passo5({ p, leitura, podeAprovar }: { p: P; leitura: boolean; podeAprovar: boolean }) {
  const calc = calcularPedido(p);
  const aprovada = aprovacaoValida(p);
  const c = calc.comparacao;
  const ok = c && !c.erros.length;
  return (
    <div className="pilha" style={{ gap: 24 }}>
      {ok ? (
        <div className="cartoes-numero mb-0">
          <div className="cartao cartao-numero">
            <span className="rotulo-n">Diferença por mês</span>
            <span className="valor-n" style={{ display: "block" }}>
              {brl(c.diferencaMensal)}
            </span>
            <span className="det-n">
              {brl(c.mensalAntes)} → {brl(c.mensalAgora)} {c.variacaoPct && `(+${pct(c.variacaoPct)})`}
            </span>
          </div>
          <div className="cartao cartao-numero">
            <span className="rotulo-n">Desde a data-base</span>
            <span className="valor-n" style={{ display: "block" }}>
              {calc.retroativo ? brl(calc.retroativo.total) : "—"}
            </span>
            <span className="det-n">
              de {data(p.dataBase)} até {data(calc.dataReferencia)}
            </span>
          </div>
          <div className="cartao cartao-numero">
            <span className="rotulo-n">Memória de cálculo</span>
            <span className="valor-n" style={{ display: "block", fontSize: 20, lineHeight: "28px" }}>
              {aprovada ? (
                <span className="fileira" style={{ color: "var(--verde)" }}>
                  <CheckCircle2 size={22} strokeWidth={1.5} aria-hidden /> Aprovada
                </span>
              ) : (
                "Aguardando aprovação"
              )}
            </span>
            <span className="det-n">{aprovada ? `por ${p.memoriaAprovadaPor}` : "Contador ou Dono aprova"}</span>
          </div>
        </div>
      ) : (
        <Alerta tipo="erro" titulo="O cálculo tem pendências">
          Volte ao <Link href={`/app/pedidos/${p.id}/passo/3`}>passo 3</Link> para corrigir.
        </Alerta>
      )}

      <div className="grade-2">
        <div className="cartao">
          <h2>Resumo</h2>
          <dl className="dl-resumo">
            <dt>Motivo</dt>
            <dd>
              {NOME_GATILHO[p.gatilho]}
              {p.convencao ? ` · ${p.convencao.nome}` : ""}
            </dd>
            <dt>
              <Termo>data-base</Termo>
            </dt>
            <dd>{data(p.dataBase)}</dd>
            <dt>Depósito da convenção</dt>
            <dd>{data(p.dataDeposito)}</dd>
          </dl>
          <Link href={`/app/pedidos/${p.id}/memoria`} className="btn mt-16">
            <FileSpreadsheet size={16} strokeWidth={1.5} aria-hidden />
            {podeAprovar && !aprovada ? "Revisar e aprovar a memória" : "Ver a memória de cálculo"}
          </Link>
        </div>
        <div className="cartao">
          <h2>Gerar o pedido</h2>
          <p className="secundario">A Equapar monta o ofício (Word e PDF), a planilha (Excel), a memória de cálculo (PDF) e um ZIP com os anexos, prontos para protocolar.</p>
          {!aprovada && <Alerta tipo="atencao">A memória precisa ser aprovada por Contador ou Dono antes de gerar.</Alerta>}
          <FormAcao action={gerarPedido} semToast>
            <input type="hidden" name="pedidoId" value={p.id} />
            {revisaoEspecialistaAtiva() && (
              <label className="check mt-16" style={{ marginBottom: 8 }}>
                <input type="checkbox" name="revisao" defaultChecked={p.revisaoEspecialista} disabled={leitura} />
                <span>
                  Pedir revisão de especialista
                  <span className="ajuda-texto" style={{ display: "block" }}>
                    Cobrada à parte. Um profissional confere a memória antes do protocolo.
                  </span>
                </span>
              </label>
            )}
            <div className="rodape-assistente">
              <Link href={`/app/pedidos/${p.id}/passo/4`} className="btn">
                Voltar
              </Link>
              {!leitura && (
                <BotaoEnvio pendente="Gerando o ofício, a planilha e a memória…">
                  <FileText size={16} strokeWidth={1.5} aria-hidden /> Gerar pedido
                </BotaoEnvio>
              )}
            </div>
          </FormAcao>
        </div>
      </div>
    </div>
  );
}
