import { Sparkles } from "lucide-react";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { AreaArquivo } from "@/components/ui/arquivo";
import { brl } from "@/lib/calculo/motor";
import type { SugestoesConvencao } from "@/lib/sugestoes-convencao";
import { aplicarSugestoesConvencao, descartarSugestoesConvencao, lerConvencaoComIa } from "../../../acoes";

/**
 * 5.5: leitura da convenção com IA no passo 3. A IA sugere; a pessoa marca, corrige se for o caso e
 * confirma linha a linha. Sem ANTHROPIC_API_KEY, este bloco não aparece e o passo segue à mão.
 */
export function ConvencaoIa({ pedidoId, sugestoes }: { pedidoId: string; sugestoes: SugestoesConvencao | null }) {
  const valor = (tipo: string, v: string) => (tipo === "PERCENTUAL" ? `${v.replace(".", ",")}%` : brl(v));
  if (!sugestoes)
    return (
      <section className="cartao" aria-labelledby="ia-conv">
        <h2 id="ia-conv" className="fileira">
          <Sparkles size={18} strokeWidth={1.5} aria-hidden /> Ler a convenção com IA
        </h2>
        <p className="secundario">
          Envie o PDF da convenção nova. A IA sugere o valor novo de cada linha que a convenção define, com a cláusula e a página. Nada entra no cálculo sem você conferir e confirmar.
        </p>
        <FormAcao action={lerConvencaoComIa}>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <AreaArquivo tipos={["pdf"]} enviarAoEscolher textoEnviando="Lendo a convenção… pode levar até 1 minuto" />
        </FormAcao>
      </section>
    );
  const link = (pagina: number) => `/api/documentos/${sugestoes.documentoId}?ver=1#page=${pagina}`;
  return (
    <section className="cartao" aria-labelledby="ia-conv">
      <div className="cartao-cab">
        <h2 id="ia-conv" className="fileira">
          <Sparkles size={18} strokeWidth={1.5} aria-hidden /> Confira o que a IA leu na convenção
        </h2>
        <FormAcao action={descartarSugestoesConvencao} semToast>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <BotaoEnvio className="btn btn-discreto btn-pequeno" pendente="Descartando…">
            Descartar sugestões
          </BotaoEnvio>
        </FormAcao>
      </div>
      <p className="secundario">
        Abra a página de cada linha, confira o número e marque. Você pode corrigir o valor antes de confirmar. A fonte de cada linha confirmada vira a cláusula e a página da convenção.
      </p>
      {sugestoes.observacoes && <p className="ajuda-texto">Observações da leitura: {sugestoes.observacoes}</p>}
      {sugestoes.itens.length === 0 ? (
        <p className="mb-0">A leitura não achou valores para as linhas da planilha. Atualize à mão no editor abaixo.</p>
      ) : (
        <FormAcao action={aplicarSugestoesConvencao} className="pilha-8">
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <ul className="lista-limpa pilha-8">
            {sugestoes.itens.map((it) => {
              const k = `${it.postoId}:${it.linhaId}`;
              return (
                <li key={k} className={`sugestao-ia${it.confianca === "baixa" ? " baixa" : ""}`}>
                  <label className="check" style={{ alignItems: "flex-start" }}>
                    <input type="checkbox" name={`ok:${k}`} />
                    <span>
                      <strong style={{ fontWeight: 500 }}>
                        {it.descricao} · {it.posto}
                      </strong>
                      <span className="legenda" style={{ display: "block" }}>
                        Hoje: {valor(it.tipo, it.valorAtual)} · {it.clausula},{" "}
                        <a href={link(it.pagina)} target="_blank" rel="noopener">
                          página {it.pagina}
                        </a>
                        {it.confianca === "baixa" && " · leitura incerta, confira com atenção"}
                      </span>
                      {it.trecho && <span className="legenda" style={{ display: "block" }}>&ldquo;{it.trecho}&rdquo;</span>}
                    </span>
                  </label>
                  <div className="campo mb-0" style={{ maxWidth: 180 }}>
                    <label htmlFor={`v-${k}`}>Valor novo{it.tipo === "PERCENTUAL" ? " (%)" : " (R$)"}</label>
                    <input id={`v-${k}`} name={`valor:${k}`} defaultValue={it.valorNovo.replace(".", ",")} inputMode="decimal" />
                  </div>
                </li>
              );
            })}
          </ul>
          <BotaoEnvio className="btn btn-primario">Confirmar as linhas marcadas</BotaoEnvio>
        </FormAcao>
      )}
    </section>
  );
}
