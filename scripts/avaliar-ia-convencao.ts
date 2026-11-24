/**
 * E3. Avalia a leitura de convenção com IA contra o gabarito.
 *
 *   npx tsx --tsconfig tsconfig.worker.json --env-file=.env scripts/avaliar-ia-convencao.ts \
 *     [--pasta convencoes-reais] [--gabarito fixtures/gabarito-convencoes.json] \
 *     [--preco-entrada <R$ ou US$ por milhão de tokens> --preco-saida <idem>] [--simular <respostas.json>]
 *
 * - Os PDFs ficam numa pasta FORA do git (trava 9), com os nomes do campo "arquivo" do gabarito.
 * - Chama lerConvencaoPdf (as mesmas instruções do sistema; INSTRUCOES_CONVENCAO não muda sem o "ok" do dono)
 *   com as linhas do posto de exemplo e compara valor, cláusula e página com o gabarito.
 * - Sem ANTHROPIC_API_KEY, só roda com --simular (respostas gravadas), para conferir o caminho da avaliação.
 * - Não gasta nada sem você pedir: a chamada à API acontece só quando a chave existe e você roda o script.
 */
import fs from "node:fs";
import path from "node:path";
import { lerConvencaoPdfDetalhado, type LeituraConvencao } from "../src/lib/ia";
import { linhasParaConvencao } from "../src/lib/sugestoes-convencao";
import { avaliarLeitura, podeLigar, POSTO_EXEMPLO, resumo, type ConvencaoGabarito } from "../src/lib/avaliacao-ia";

const arg = (nome: string) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const pasta = arg("--pasta") ?? "convencoes-reais";
const arqGabarito = arg("--gabarito") ?? "fixtures/gabarito-convencoes.json";
const simular = arg("--simular");
const precoEntrada = arg("--preco-entrada") ? Number(arg("--preco-entrada")) : null;
const precoSaida = arg("--preco-saida") ? Number(arg("--preco-saida")) : null;

async function main() {
  const g = JSON.parse(fs.readFileSync(arqGabarito, "utf8")) as { convencoes: ConvencaoGabarito[] };
  const respostas = simular ? (JSON.parse(fs.readFileSync(simular, "utf8")) as Record<string, LeituraConvencao>) : null;
  if (!respostas && !process.env.ANTHROPIC_API_KEY) {
    console.log("Sem ANTHROPIC_API_KEY: nada foi enviado. Para conferir o caminho da avaliação sem a API, use --simular <respostas.json>.");
    process.exitCode = 1;
    return;
  }
  const naoConferidas = g.convencoes.filter((c) => !c.conferido);
  if (naoConferidas.length)
    console.log(`AVISO: Gabarito não conferido por pessoa: o resultado não autoriza ligar a IA. (${naoConferidas.map((c) => c.registro).join(", ")})\n`);
  console.log(`Modo: ${respostas ? `SIMULAÇÃO (respostas gravadas em ${simular}; nenhuma chamada à API)` : "API da Anthropic"} · gabarito ${arqGabarito}\n`);

  const linhas = linhasParaConvencao(POSTO_EXEMPLO);
  let totalErrosAlta = 0;
  for (const c of g.convencoes) {
    let leitura: LeituraConvencao;
    let uso: { entrada: number; saida: number } | null = null;
    const t0 = Date.now();
    if (respostas) {
      if (!respostas[c.id]) {
        console.log(`${c.registro}: sem resposta gravada, pulada.\n`);
        continue;
      }
      leitura = respostas[c.id];
    } else {
      const arquivo = path.join(pasta, c.arquivo);
      if (!fs.existsSync(arquivo)) {
        console.log(`${c.registro}: PDF não encontrado em ${arquivo}, pulada.\n`);
        continue;
      }
      // P0: a avaliação também passa pelo orçamento (IA_ORCAMENTO_AVALIACAO_USD_MES, dentro do teto global); o modelo vem de IA_MODELO
      const r = await lerConvencaoPdfDetalhado(fs.readFileSync(arquivo), linhas, { contaId: "interno-avaliacao", usuarioId: null, plano: "INTERNO", operacao: "AVALIACAO" });
      leitura = r.leitura;
      uso = r.uso;
    }
    const ms = Date.now() - t0;
    const itens = avaliarLeitura(c, leitura);
    const r = resumo(itens, leitura.sugestoes.filter((s) => s.confianca === "baixa").length);
    totalErrosAlta += r.errosComConfiancaAlta;
    console.log(`== ${c.registro} (${c.id}) ${c.conferido ? "· gabarito conferido" : "· GABARITO NÃO CONFERIDO"}`);
    console.log(`   acertos ${r.acertos} · erros ${r.erros} · omissões ${r.omissoes} · deixados para conferência humana (confiança baixa) ${r.paraConferenciaHumana}`);
    console.log(`   por confiança: alta ${r.porConfianca.alta.acertos} acertos / ${r.porConfianca.alta.erros} erros · baixa ${r.porConfianca.baixa.acertos} acertos / ${r.porConfianca.baixa.erros} erros`);
    for (const i of itens.filter((x) => x.resultado !== "acerto"))
      console.log(`   ${i.resultado.toUpperCase()} ${i.campo} [${i.confianca ?? "-"}]: ${i.motivo}${i.trecho ? ` · trecho: "${i.trecho.slice(0, 160)}"` : ""}`);
    console.log(`   unidade e condição: não avaliadas (a leitura atual não devolve esses campos; mudar exige alterar INSTRUCOES_CONVENCAO, com o "ok" do dono)`);
    const custo = uso && precoEntrada != null && precoSaida != null ? ` · custo ${((uso.entrada * precoEntrada + uso.saida * precoSaida) / 1e6).toFixed(4)}` : "";
    console.log(`   tempo ${(ms / 1000).toFixed(1)} s${uso ? ` · tokens ${uso.entrada} de entrada e ${uso.saida} de saída${custo}` : " · tokens: simulação"}\n`);
  }
  const conferido = naoConferidas.length === 0;
  console.log(
    podeLigar(conferido, totalErrosAlta)
      ? "RESULTADO: o gabarito está conferido e nenhum erro tem confiança alta. A IA pode ser ligada."
      : `RESULTADO: NÃO ligar a IA (${[!conferido ? "gabarito não conferido por pessoa" : "", totalErrosAlta ? `${totalErrosAlta} erro(s) com confiança alta` : ""].filter(Boolean).join("; ")}).`,
  );
}

main();
