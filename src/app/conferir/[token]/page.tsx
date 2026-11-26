import { headers } from "next/headers";
import { CheckCircle2, FileSpreadsheet, FileText } from "lucide-react";
import { brl, pct } from "@/lib/calculo/motor";
import { calcularPedido, NOME_GATILHO } from "@/lib/pedido";
import { data, dataLocal, MESES } from "@/lib/format";
import { aprovacaoValida } from "@/lib/pedido-regras";
import { Alerta } from "@/components/ui/estrutura";
import { MENSAGEM_CONFERENCIA } from "@/lib/conferencia";
import { abrirConferencia, registrarAcessoConferencia } from "@/lib/conferencia-servidor";
import { MemoriaView } from "../../app/pedidos/[id]/memoria/memoria-view";

/** Conferência da memória de cálculo pelo contador externo: só leitura, sem conta, por link assinado (14 dias). */
export default async function Conferir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const aberto = await abrirConferencia(token, await headers());
  if (aberto.erro) {
    const texto = aberto.erro === "limite" ? "Muitos acessos a este link hoje. Tente de novo amanhã." : MENSAGEM_CONFERENCIA[aberto.erro];
    return <Alerta tipo="atencao" titulo="Não foi possível abrir a conferência">{texto}</Alerta>;
  }
  const { p, t } = aberto;
  await registrarAcessoConferencia(p, "abriu a memória de cálculo");
  const calc = calcularPedido(p);
  const comp = calc.comparacao;
  const conv = p.convencao ?? p.contrato.convencao;
  const aprovada = aprovacaoValida(p);

  return (
    <>
      <p className="legenda mb-0">Conferência enviada por {p.contrato.empresa.razaoSocial}</p>
      <h1 className="mb-0">Memória de cálculo</h1>
      <p className="secundario">
        Contrato {p.contrato.numero} · {p.contrato.orgao} · {NOME_GATILHO[p.gatilho]}
        {conv ? ` · ${conv.nome}` : ""} · data-base {data(p.dataBase)}
      </p>
      <div className="fileira mb-16">
        {aprovada ? (
          <span className="selo selo-verde">
            <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden /> Aprovada por {p.memoriaAprovadaPor} em {dataLocal(p.memoriaAprovadaEm!)}
          </span>
        ) : (
          <span className="selo selo-ambar">Ainda não aprovada na empresa</span>
        )}
        <span className="legenda">Link válido até {data(new Date(t.vence))}</span>
      </div>
      {!comp || comp.erros.length ? (
        <Alerta tipo="atencao" titulo="A memória está sendo ajustada">
          A planilha tem pendências neste momento. Peça a quem enviou para concluir o passo 3 e abra o link de novo.
        </Alerta>
      ) : (
        <>
          <div className="fileira mb-16">
            <a href={`/conferir/${token}/memoria.pdf`} className="btn" download>
              <FileText size={16} strokeWidth={1.5} aria-hidden /> Memória de cálculo (PDF)
            </a>
            <a href={`/conferir/${token}/planilha.xlsx`} className="btn" download>
              <FileSpreadsheet size={16} strokeWidth={1.5} aria-hidden /> Planilha (Excel)
            </a>
          </div>
          <div className="memoria-topo">
            <div>
              <span className="legenda">Diferença por mês</span>
              <strong className="tnum">{brl(comp.diferencaMensal)}</strong>
              <span className="legenda">
                {brl(comp.mensalAntes)} → {brl(comp.mensalAgora)} {comp.variacaoPct && `(+${pct(comp.variacaoPct)})`}
              </span>
            </div>
            <div>
              <span className="legenda">
                Desde a data-base ({p.dataBase ? `${MESES[p.dataBase.getUTCMonth()]} de ${p.dataBase.getUTCFullYear()}` : "não informada"})
              </span>
              <strong className="tnum">{calc.retroativo ? brl(calc.retroativo.total) : "—"}</strong>
              <span className="legenda">
                até {data(calc.dataReferencia)} · {calc.regraRetroativo}
              </span>
              {calc.jaPago && (
                <span className="legenda">
                  {brl(calc.retroativoBruto!)} menos {brl(calc.jaPago)} já pagos pelo órgão no período
                </span>
              )}
            </div>
            {calc.comparacaoMes && (
              <div>
                <span className="legenda">Regra do caso em análise: mês incompleto</span>
                <span className="legenda">
                  Dias corridos: <strong>{brl(calc.comparacaoMes.DIAS_CORRIDOS)}</strong> · Mês de 30 dias: <strong>{brl(calc.comparacaoMes.MES_30_DIAS)}</strong>
                </span>
              </div>
            )}
          </div>
          <MemoriaView pedidoId={p.id} comp={comp} retro={calc.retroativo} comentarios={[]} podeComentar={false} linkConvencao={null} />
          <p className="legenda leitura mt-24">
            Metodologia: estrutura da IN SEGES/MP 05/2017, Anexo VII-D · cada linha arredondada a 2 casas, meio para cima, e o total soma as linhas arredondadas · tributos por dentro · regra{" "}
            {calc.versaoRegra}. Os números vêm da planilha da proposta e da convenção informadas pela empresa.
          </p>
        </>
      )}
    </>
  );
}
