import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ErroUsuario } from "./acao";

/**
 * Leitura de planilha de custos em PDF com Claude.
 * A IA só SUGERE linhas (descrição, módulo, tipo, número e página de origem).
 * Nada entra no cálculo sem o usuário conferir na tela do passo 2.
 * Sem ANTHROPIC_API_KEY, a leitura de PDF fica desativada (o usuário digita ou envia Excel).
 */

export function iaAtiva() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const Linha = z.object({
  descricao: z.string(),
  modulo: z.enum(["M1", "M2_1", "M2_2", "M2_3", "M3", "M4", "M5", "M6_CI", "M6_LUCRO", "M6_TRIBUTOS"]),
  tipo: z.enum(["VALOR", "PERCENTUAL"]),
  valor: z.string().describe("Número com ponto decimal, sem R$ nem %, ex.: 1820.00 ou 8.33"),
  salarioBase: z.boolean(),
  pagina: z.number().int(),
  confianca: z.enum(["alta", "baixa"]),
});

const Saida = z.object({
  postos: z.array(z.object({ nome: z.string(), quantidade: z.number().int(), linhas: z.array(Linha) })),
  observacoes: z.string(),
});

export type LeituraIa = z.infer<typeof Saida>;

const INSTRUCOES = `Você lê planilhas de custos e formação de preços de contratos públicos de serviços com mão de obra (modelo da IN SEGES/MP 05/2017, Anexo VII-D).
Extraia cada linha que tenha um número, por tipo de posto, classificando no módulo correto:
M1 remuneração; M2_1 13º e férias; M2_2 GPS, FGTS e contribuições; M2_3 benefícios; M3 rescisão; M4 reposição do ausente; M5 insumos; M6_CI custos indiretos; M6_LUCRO lucro; M6_TRIBUTOS tributos.
Regras:
- Copie os números exatamente como estão no documento; nunca calcule, arredonde ou invente valores.
- Linha em percentual: tipo PERCENTUAL e o percentual em "valor" (8,33% vira "8.33"). Linha em reais: tipo VALOR.
- Marque salarioBase=true só na linha do salário base do Módulo 1.
- Ignore linhas de total e subtotal.
- Se não tiver certeza da leitura de uma linha, use confianca "baixa".
- Informe a página de onde saiu cada linha.`;

export async function lerPlanilhaPdf(pdf: Buffer): Promise<LeituraIa> {
  const client = new Anthropic();
  const resposta = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(Saida) },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: INSTRUCOES },
        ],
      },
    ],
  });
  if (resposta.stop_reason === "refusal") throw new ErroUsuario("A leitura automática recusou este documento. Preencha as linhas à mão.");
  if (resposta.stop_reason === "max_tokens") throw new ErroUsuario("A planilha é longa demais para a leitura automática. Envie em Excel ou divida o PDF.");
  if (!resposta.parsed_output) throw new ErroUsuario("Não foi possível ler a planilha. Preencha as linhas à mão.");
  return resposta.parsed_output;
}

// ---------------------------------------------------------------------------
// 5.5: leitura da convenção coletiva com IA
// ---------------------------------------------------------------------------

/** Linha da planilha nova que a convenção pode afetar (o que a IA recebe para comparar). */
export interface LinhaParaConvencao {
  postoId: string;
  posto: string;
  linhaId: string;
  modulo: string;
  descricao: string;
  tipo: "VALOR" | "PERCENTUAL";
  valorAtual: string;
}

const Sugestao = z.object({
  postoId: z.string(),
  linhaId: z.string(),
  valorNovo: z.string().describe("Número com ponto decimal, sem R$ nem %, exatamente como está na convenção"),
  clausula: z.string().describe('Ex.: "Cláusula 4ª" ou "Cláusula 12ª, parágrafo 2º"'),
  pagina: z.number().int(),
  trecho: z.string().describe("Trecho curto da convenção de onde saiu o número"),
  confianca: z.enum(["alta", "baixa"]),
});

const SaidaConvencao = z.object({ sugestoes: z.array(Sugestao), observacoes: z.string() });
export type LeituraConvencao = z.infer<typeof SaidaConvencao>;

const INSTRUCOES_CONVENCAO = `Você lê convenções coletivas de trabalho para atualizar a planilha de custos de contratos públicos de serviços com mão de obra (IN SEGES/MP 05/2017, Anexo VII-D).
Você recebe a convenção em PDF e a lista de linhas da planilha (posto, linha, módulo, tipo e valor atual).
Para cada linha cujo valor a convenção define (piso salarial, adicionais, vale-alimentação, vale-transporte, cesta, plano de saúde, auxílios e outros benefícios), sugira o valor novo.
Regras:
- Copie o número exatamente como está na convenção; nunca calcule, projete, arredonde ou invente valores.
- Só sugira linhas que a convenção define de forma explícita. Se a convenção não trata da linha, não a inclua.
- Use o postoId e o linhaId exatamente como recebidos.
- Informe a cláusula, a página do PDF e um trecho curto de onde saiu o número.
- Se a leitura for incerta (tabela confusa, mais de um valor possível, função diferente da do posto), use confianca "baixa" e explique em observacoes.`;

export async function lerConvencaoPdf(pdf: Buffer, linhas: LinhaParaConvencao[]): Promise<LeituraConvencao> {
  const client = new Anthropic();
  const resposta = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(SaidaConvencao) },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: `${INSTRUCOES_CONVENCAO}\n\nLinhas da planilha (JSON):\n${JSON.stringify(linhas)}` },
        ],
      },
    ],
  });
  if (resposta.stop_reason === "refusal") throw new ErroUsuario("A leitura automática recusou este documento. Atualize as linhas à mão.");
  if (resposta.stop_reason === "max_tokens") throw new ErroUsuario("A convenção é longa demais para a leitura automática. Atualize as linhas à mão.");
  if (!resposta.parsed_output) throw new ErroUsuario("Não foi possível ler a convenção. Atualize as linhas à mão.");
  return resposta.parsed_output;
}
