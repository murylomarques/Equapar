/**
 * P0: custo unitário e projeções de IA, sem chamar a API (nenhum gasto). `npm run custo:ia`
 *
 * Usa a tabela de preços do código (src/lib/ia-orcamento.ts, fonte: página de preços da Anthropic, 24/11/2026)
 * e PREMISSAS explícitas de tokens por documento. As premissas são estimativas para planejar o orçamento:
 * o custo real de cada leitura fica no livro UsoIa e deve substituir estas premissas depois da avaliação real.
 */
import { custoUsd, piorCustoUsd, configIa } from "../src/lib/ia-orcamento";

const CAMBIO = Number(process.env.CAMBIO_USD_BRL ?? 5.4); // premissa: R$ por US$
const MODELOS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

// Premissas por tipo de documento (tokens). PDF: ~1.500 a 3.000 tokens por página (texto + imagem da página).
const DOCS = [
  { nome: "Planilha de custos, 4 páginas (3 postos, ~90 linhas)", entrada: 4 * 2500 + 1500, saida: 7000, paginas: 4 },
  { nome: "Planilha de custos, 12 páginas (8 postos)", entrada: 12 * 2500 + 1500, saida: 15000, paginas: 12 },
  { nome: "Convenção coletiva, 25 páginas", entrada: 25 * 2500 + 3000, saida: 2500, paginas: 25 },
  { nome: "Convenção coletiva, 40 páginas (limite)", entrada: 40 * 2500 + 3000, saida: 3000, paginas: 40 },
];

const brl = (usd: number) => `R$ ${(usd * CAMBIO).toFixed(2).replace(".", ",")}`;
const us = (v: number) => `US$ ${v.toFixed(3)}`;

console.log(`# Custo de IA por documento (premissas; câmbio R$ ${CAMBIO} por US$)\n`);
console.log(`| Documento | ${MODELOS.join(" | ")} | Reserva de pior caso (${configIa().modelo}) |`);
console.log(`|---|${MODELOS.map(() => "---").join("|")}|---|`);
for (const d of DOCS) {
  const custos = MODELOS.map((m) => custoUsd(m, { entrada: d.entrada, saida: d.saida }).toNumber());
  const pior = piorCustoUsd(configIa().modelo, { paginas: d.paginas, tokensExtras: 1500 }).toNumber();
  console.log(`| ${d.nome} | ${custos.map((c) => `${us(c)} (${brl(c)})`).join(" | ")} | ${us(pior)} |`);
}

// Uso mensal por perfil: leituras de planilha (4 páginas) e de convenção (25 páginas) por mês.
const PERFIS = [
  { nome: "leve", planilhas: 1, convencoes: 1 },
  { nome: "típico", planilhas: 4, convencoes: 2 },
  { nome: "intenso", planilhas: 15, convencoes: 6 },
];
const custoMes = (m: string, p: { planilhas: number; convencoes: number }) =>
  p.planilhas * custoUsd(m, { entrada: DOCS[0].entrada, saida: DOCS[0].saida }).toNumber() + p.convencoes * custoUsd(m, { entrada: DOCS[2].entrada, saida: DOCS[2].saida }).toNumber();

console.log(`\n# Custo mensal por cliente (Opus 5.5)\n`);
console.log("| Perfil | Leituras/mês | US$ | R$ | % de R$ 297 (Carteira mínima) |");
console.log("|---|---|---|---|---|");
for (const p of PERFIS) {
  const c = custoMes("claude-opus-5-5", p);
  console.log(`| ${p.nome} | ${p.planilhas} planilhas + ${p.convencoes} convenções | ${us(c)} | ${brl(c)} | ${((c * CAMBIO * 100) / 297).toFixed(1)}% |`);
}

// Projeção 10/50/100 clientes: 60% leves, 30% típicos, 10% intensos, mais 1 abusivo limitado pelo teto da conta.
const TETO_CONTA = Number(process.env.TETO_PROPOSTO_CARTEIRA ?? 3);
console.log(`\n# Projeção mensal (Opus 5.5; mix 60% leve, 30% típico, 10% intenso; +1 abusivo travado no teto de US$ ${TETO_CONTA})\n`);
console.log("| Clientes | Custo esperado | Com 1 abusivo | Pior caso: todos no teto |");
console.log("|---|---|---|---|");
for (const n of [10, 50, 100]) {
  const mix = n * (0.6 * custoMes("claude-opus-5-5", PERFIS[0]) + 0.3 * custoMes("claude-opus-5-5", PERFIS[1]) + 0.1 * custoMes("claude-opus-5-5", PERFIS[2]));
  console.log(`| ${n} | ${us(mix)} (${brl(mix)}) | ${us(mix + TETO_CONTA)} (${brl(mix + TETO_CONTA)}) | ${us(n * TETO_CONTA)} (${brl(n * TETO_CONTA)}) |`);
}
console.log("\nO teto global (IA_ORCAMENTO_GLOBAL_USD_MES) corta a última coluna: o gasto do mês nunca passa dele.");
