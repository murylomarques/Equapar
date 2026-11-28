/**
 * Gera o documento de revisão jurídica dos guias: todos os guias com `revisao: "pendente"` e os rascunhos de
 * ampliação de guias já publicados, em Markdown legível (sem código), com as notas de cada afirmação.
 *
 * Uso: npx tsx scripts/guias-para-revisao.ts <saida.md> [pasta-de-notas]
 * Depois da revisão: no arquivo do guia, troque `revisao: "pendente"` por `revisao: "aprovada"` (ou aplique as correções).
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { GUIAS, RASCUNHOS } from "../src/lib/guias";
import type { Guia } from "../src/lib/guias";

const [saida, pastaNotas] = process.argv.slice(2);
if (!saida) {
  console.error("Uso: npx tsx scripts/guias-para-revisao.ts <saida.md> [pasta-de-notas]");
  process.exit(1);
}

function guiaMd(g: Guia, rotulo: string) {
  const l: string[] = [];
  l.push(`# ${g.titulo}`, "");
  l.push(`*${rotulo} · endereço: /guias/${g.slug}${g.termo ? ` · busca principal: "${g.termo}"` : ""}*`, "");
  l.push(`> ${g.descricao}`, "");
  if (g.resumo?.length) l.push("**Em resumo**", "", ...g.resumo.map((r) => `- ${r}`), "");
  for (const s of g.secoes) {
    l.push(`## ${s.titulo}`, "");
    for (const p of s.paragrafos) l.push(p.startsWith('"') && p.endsWith('"') ? `> ${p.slice(1, -1)}` : p, "");
    if (s.lista) l.push(...s.lista.map((x) => `- ${x}`), "");
    if (s.tabela) {
      if (s.tabela.legenda) l.push(`*${s.tabela.legenda}*`, "");
      l.push(`| ${s.tabela.cabecalho.join(" | ")} |`, `| ${s.tabela.cabecalho.map(() => "---").join(" | ")} |`, ...s.tabela.linhas.map((x) => `| ${x.join(" | ")} |`), "");
    }
    for (const p of s.paragrafosDepois ?? []) l.push(p.startsWith('"') && p.endsWith('"') ? `> ${p.slice(1, -1)}` : p, "");
  }
  if (g.faq?.length) {
    l.push("## Perguntas frequentes", "");
    for (const f of g.faq) l.push(`**${f.pergunta}**`, "", f.resposta, "");
  }
  l.push("## Fontes", "", ...g.fontes.map((f) => `- ${f.nome}: ${f.url}`), "");
  const nota = pastaNotas ? join(pastaNotas, `${g.slug}.md`) : null;
  if (nota && existsSync(nota)) l.push("## Notas para a revisão (afirmações jurídicas e fontes)", "", readFileSync(nota, "utf8").trim(), "");
  return l.join("\n");
}

const pendentes = GUIAS.filter((g) => g.revisao === "pendente");
const partes = [
  "# Guias da Equapar para revisão jurídica",
  "",
  `Gerado em ${new Date().toLocaleDateString("pt-BR")}. ${pendentes.length} guias novos e ${RASCUNHOS.length} ampliação(ões) de guia já publicado.`,
  "",
  "Estes textos vão para o site público (equapar.com.br/guias) e só entram no ar depois da sua aprovação. Em cada guia, as notas no fim listam cada afirmação jurídica com a fonte; as marcadas com ⚠️ pedem atenção especial (interpretação, divergência ou fonte não confirmada).",
  "",
  "Para cada guia, basta responder: **aprovado**, **aprovado com as correções indicadas** ou **não publicar**.",
  "",
  "## Sumário",
  "",
  ...pendentes.map((g, i) => `${i + 1}. ${g.titulo}`),
  ...RASCUNHOS.map((g, i) => `${pendentes.length + i + 1}. ${g.titulo} (ampliação do guia publicado)`),
  "",
  "---",
  "",
  ...pendentes.map((g) => guiaMd(g, "Guia novo") + "\n---\n"),
  ...RASCUNHOS.map((g) => guiaMd(g, "Ampliação de guia já publicado (substitui o texto atual)") + "\n---\n"),
];
writeFileSync(saida, partes.join("\n"));
console.log(`${pendentes.length + RASCUNHOS.length} guias em ${saida}`);
