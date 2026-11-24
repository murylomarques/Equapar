import "server-only";
import crypto from "node:crypto";
import Anthropic, { APIConnectionError, APIError } from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ErroUsuario } from "./acao";
import { db } from "./db";
import type { PlanoId } from "./planos";
import { bloqueioPrevio, concluir, configIa, eReserva, falhar, registrarCache, reservar, type OperacaoIa, type Uso } from "./ia-orcamento";

/**
 * Leitura de planilha de custos em PDF com Claude.
 * A IA só SUGERE linhas (descrição, módulo, tipo, número e página de origem).
 * Nada entra no cálculo sem o usuário conferir na tela do passo 2.
 * Sem ANTHROPIC_API_KEY, a leitura de PDF fica desativada (o usuário digita ou envia Excel).
 * P0: toda chamada paga passa por executarComOrcamento (cache, limites, reserva de orçamento, tentativas).
 */

export function iaAtiva() {
  return !!process.env.ANTHROPIC_API_KEY && !configIa().desligada;
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

export async function lerPlanilhaPdf(pdf: Buffer, quem: QuemUsa): Promise<LeituraIa> {
  return executarComOrcamento({
    ...quem,
    operacao: "LEITURA_PLANILHA",
    pdf,
    instrucoes: INSTRUCOES,
    mensagens: {
      recusa: "A leitura automática recusou este documento. Preencha as linhas à mão.",
      longo: "A planilha é longa demais para a leitura automática. Envie em Excel ou divida o PDF.",
      falha: "Não foi possível ler a planilha. Preencha as linhas à mão.",
    },
    chamar: (cliente, modelo, maxSaida) =>
      cliente.messages.parse({
        model: modelo,
        max_tokens: maxSaida,
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
      }),
  });
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

export async function lerConvencaoPdf(pdf: Buffer, linhas: LinhaParaConvencao[], quem: QuemUsa): Promise<LeituraConvencao> {
  return (await lerConvencaoPdfDetalhado(pdf, linhas, quem)).leitura;
}

/** E3: a mesma leitura, devolvendo também os tokens usados (para a avaliação medir custo e tempo). As instruções não mudam. */
export async function lerConvencaoPdfDetalhado(pdf: Buffer, linhas: LinhaParaConvencao[], quem: QuemUsa): Promise<{ leitura: LeituraConvencao; uso: { entrada: number; saida: number } }> {
  let uso = { entrada: 0, saida: 0 };
  const texto = `${INSTRUCOES_CONVENCAO}\n\nLinhas da planilha (JSON):\n${JSON.stringify(linhas)}`;
  const leitura = await executarComOrcamento({
    ...quem,
    operacao: quem.operacao ?? "LEITURA_CONVENCAO",
    pdf,
    instrucoes: texto,
    mensagens: {
      recusa: "A leitura automática recusou este documento. Atualize as linhas à mão.",
      longo: "A convenção é longa demais para a leitura automática. Atualize as linhas à mão.",
      falha: "Não foi possível ler a convenção. Atualize as linhas à mão.",
    },
    aoConcluir: (u) => (uso = { entrada: u.entrada, saida: u.saida }),
    chamar: (cliente, modelo, maxSaida) =>
      cliente.messages.parse({
        model: modelo,
        max_tokens: maxSaida,
        output_config: { effort: "medium", format: zodOutputFormat(SaidaConvencao) },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
              { type: "text", text: texto },
            ],
          },
        ],
      }),
  });
  return { leitura, uso };
}

// ---------------------------------------------------------------------------
// P0: toda chamada paga passa por aqui (cache, limites de documento, reserva de orçamento, tentativas)
// ---------------------------------------------------------------------------

/** Quem paga a leitura. `plano: "INTERNO"` só para as avaliações do dono (orçamento próprio, dentro do teto global). */
export type QuemUsa = { contaId: string; usuarioId: string | null; plano: PlanoId | "INTERNO"; operacao?: OperacaoIa };

type RespostaIa<T> = {
  parsed_output: T | null;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
};

// sem tentativas automáticas do SDK: cada tentativa passa pela reserva de orçamento
let fabricaCliente: () => Anthropic = () => new Anthropic({ maxRetries: 0, timeout: 120_000 });
/** Testes: troca o cliente da API por um falso (nenhuma chamada paga sai do teste). */
export function definirClienteIa(f: () => Anthropic) {
  fabricaCliente = f;
}

export async function contarPaginas(pdf: Buffer) {
  try {
    return (await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    throw new ErroUsuario("Não conseguimos abrir este PDF. Confira o arquivo ou envie a planilha em Excel.");
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");

async function executarComOrcamento<T>(
  o: QuemUsa & {
    operacao: OperacaoIa;
    pdf: Buffer;
    instrucoes: string;
    mensagens: { recusa: string; longo: string; falha: string };
    chamar: (cliente: Anthropic, modelo: string, maxSaida: number) => Promise<RespostaIa<T>>;
    aoConcluir?: (u: Uso) => void;
  },
): Promise<T> {
  const cfg = configIa();
  const modelo = cfg.modelo;
  const hashDocumento = sha(o.pdf);
  // a chave muda quando o documento, o modelo, a operação ou as instruções mudam
  const chave = sha(`${o.operacao}|${modelo}|${hashDocumento}|${sha(o.instrucoes)}`);
  const emCache = await db.cacheIa.findUnique({ where: { contaId_chave: { contaId: o.contaId, chave } } });
  if (emCache) {
    await db.cacheIa.update({ where: { id: emCache.id }, data: { usos: { increment: 1 } } });
    await registrarCache({ contaId: o.contaId, usuarioId: o.usuarioId, operacao: o.operacao, modelo, bytes: o.pdf.length, hashDocumento });
    return emCache.resultado as T;
  }
  // tamanho e plano primeiro (barato); páginas depois
  const previo = bloqueioPrevio({ plano: o.plano, bytes: o.pdf.length, paginas: 0 }, cfg);
  if (previo) throw new ErroUsuario(previo.mensagem);
  const paginas = await contarPaginas(o.pdf);
  const tokensExtras = Math.ceil(o.instrucoes.length / 2); // pior caso: ~2 caracteres por token
  let ultimoErro = o.mensagens.falha;
  for (let tentativa = 1; tentativa <= cfg.tentativas; tentativa++) {
    const r = await reservar({ contaId: o.contaId, usuarioId: o.usuarioId, plano: o.plano, operacao: o.operacao, modelo, bytes: o.pdf.length, paginas, tokensExtras, hashDocumento, tentativa });
    if (!eReserva(r)) throw new ErroUsuario(r.mensagem);
    const inicio = Date.now();
    let resposta: RespostaIa<T>;
    try {
      resposta = await o.chamar(fabricaCliente(), modelo, cfg.maxSaida);
    } catch (e) {
      const duracao = Date.now() - inicio;
      // resposta de erro da API não é cobrada; tempo esgotado ou conexão caída pode ter sido: conta o reservado
      const incerto = e instanceof APIConnectionError || !(e instanceof APIError);
      await falhar(r.id, incerto ? "INCERTO" : "NAO", e instanceof Error ? `${e.name}: ${e.message}` : String(e), duracao);
      const status = e instanceof APIError ? e.status : undefined;
      const repetivel = incerto || status === 429 || status === 529 || (status != null && status >= 500);
      ultimoErro = status === 429 || status === 529 ? "A leitura automática está sobrecarregada agora. Tente de novo em alguns minutos." : o.mensagens.falha;
      if (!repetivel || tentativa === cfg.tentativas) break;
      await esperar(1000 * 2 ** (tentativa - 1) + Math.floor(Math.random() * 300));
      continue;
    }
    const u: Uso = {
      entrada: resposta.usage.input_tokens,
      saida: resposta.usage.output_tokens,
      cacheLeitura: resposta.usage.cache_read_input_tokens ?? 0,
      cacheEscrita: resposta.usage.cache_creation_input_tokens ?? 0,
    };
    await concluir(r.id, modelo, u, Date.now() - inicio);
    o.aoConcluir?.(u);
    // recusa, saída cortada ou vazia: já foi paga; não repete (daria o mesmo resultado)
    if (resposta.stop_reason === "refusal") throw new ErroUsuario(o.mensagens.recusa);
    if (resposta.stop_reason === "max_tokens") throw new ErroUsuario(o.mensagens.longo);
    if (!resposta.parsed_output) throw new ErroUsuario(o.mensagens.falha);
    await db.cacheIa.create({ data: { contaId: o.contaId, chave, operacao: o.operacao, resultado: resposta.parsed_output as object } }).catch(() => undefined); // leitura igual gravou primeiro
    return resposta.parsed_output;
  }
  throw new ErroUsuario(ultimoErro);
}
