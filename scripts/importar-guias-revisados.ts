/**
 * Importa o documento devolvido pelo advogado (mesmo formato gerado por guias-para-revisao.ts) para os arquivos dos
 * guias em src/lib/guias/, marcando cada guia como aprovado. Mantém do arquivo atual o que não vai para o documento
 * (relacionados). O texto do advogado entra como está.
 *
 * Uso: npx tsx scripts/importar-guias-revisados.ts <documento.md> [--gravar] [--data=AAAA-MM-DD]
 * Sem --gravar, só confere e mostra o que mudaria.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { GUIAS, RASCUNHOS } from "../src/lib/guias";
import type { Guia, SecaoGuia } from "../src/lib/guias";

const [arquivo, ...opcoes] = process.argv.slice(2);
const gravar = opcoes.includes("--gravar");
const data = opcoes.find((o) => o.startsWith("--data="))?.slice(7) ?? new Date().toISOString().slice(0, 10);
if (!arquivo) {
  console.error("Uso: npx tsx scripts/importar-guias-revisados.ts <documento.md> [--gravar] [--data=AAAA-MM-DD]");
  process.exit(1);
}

const avisos: string[] = [];
const linhas = readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n").split("\n");

// blocos de guia: começam em "# Título" seguido (após linha vazia) de "*Endereço: /guias/<slug> ..."
const inicios: number[] = [];
linhas.forEach((l, i) => {
  if (/^# /.test(l) && /^\*Endereço: \/guias\//.test(linhas[i + 2] ?? "")) inicios.push(i);
});

function tabela(bloco: string[]) {
  const celulas = (l: string) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const [cab, , ...resto] = bloco;
  return { cabecalho: celulas(cab), linhas: resto.map(celulas) };
}

function guiaDoBloco(b: string[]): Guia {
  const titulo = b[0].slice(2).trim();
  const end = b[2].match(/^\*Endereço: \/guias\/([a-z0-9-]+)(?: · busca principal: "(.*)")?\*$/);
  if (!end) throw new Error(`Endereço ilegível: ${b[2]}`);
  const slug = end[1];
  let i = 3;
  const pula = () => {
    while (i < b.length && !b[i].trim()) i++;
  };
  pula();
  if (!b[i]?.startsWith("> ")) throw new Error(`${slug}: descrição não encontrada`);
  const descricao = b[i].slice(2).trim();
  i++;
  pula();
  let resumo: string[] | undefined;
  if (b[i] === "**Em resumo**") {
    i++;
    pula();
    resumo = [];
    while (i < b.length && b[i].startsWith("- ")) resumo.push(b[i++].slice(2).trim());
  }
  const secoes: SecaoGuia[] = [];
  const faq: { pergunta: string; resposta: string }[] = [];
  const fontes: { nome: string; url: string }[] = [];
  while (i < b.length) {
    pula();
    if (i >= b.length) break;
    if (!b[i].startsWith("## ")) {
      avisos.push(`${slug}: linha fora de seção ignorada: "${b[i].slice(0, 60)}"`);
      i++;
      continue;
    }
    const tituloSecao = b[i].slice(3).trim();
    i++;
    const corpo: string[] = [];
    while (i < b.length && !b[i].startsWith("## ")) corpo.push(b[i++]);
    if (tituloSecao === "Perguntas frequentes") {
      let atual: { pergunta: string; resposta: string[] } | null = null;
      for (const l of corpo) {
        const q = l.match(/^\*\*(.+)\*\*$/);
        if (q) {
          if (atual) faq.push({ pergunta: atual.pergunta, resposta: atual.resposta.join(" ") });
          atual = { pergunta: q[1].trim(), resposta: [] };
        } else if (l.trim() && atual) atual.resposta.push(l.trim());
      }
      if (atual) faq.push({ pergunta: atual.pergunta, resposta: atual.resposta.join(" ") });
      continue;
    }
    if (tituloSecao === "Fontes") {
      for (const l of corpo) {
        const m = l.match(/^- (.+?): (https?:\/\/\S+)\s*$/);
        if (m) fontes.push({ nome: m[1].trim(), url: m[2] });
        else if (l.trim()) avisos.push(`${slug}: fonte ilegível: "${l}"`);
      }
      continue;
    }
    if (/^Notas para a revisão/.test(tituloSecao)) continue;
    const s: SecaoGuia = { titulo: tituloSecao, paragrafos: [] };
    let legenda: string | undefined;
    let viuListaOuTabela = false;
    for (let k = 0; k < corpo.length; k++) {
      const l = corpo[k];
      if (!l.trim()) continue;
      if (l.startsWith("|")) {
        const bloco: string[] = [];
        while (k < corpo.length && corpo[k].startsWith("|")) bloco.push(corpo[k++]);
        k--;
        if (s.tabela) avisos.push(`${slug} / ${tituloSecao}: mais de uma tabela (só a primeira entra)`);
        else s.tabela = { ...(legenda ? { legenda } : {}), ...tabela(bloco) };
        legenda = undefined;
        viuListaOuTabela = true;
      } else if (/^\*[^*].*\*$/.test(l.trim()) && corpo.slice(k + 1).find((x) => x.trim())?.startsWith("|")) {
        legenda = l.trim().slice(1, -1);
      } else if (l.startsWith("- ")) {
        (s.lista ??= []).push(l.slice(2).trim());
        viuListaOuTabela = true;
      } else {
        const p = l.startsWith("> ") ? `"${l.slice(2).trim()}"` : l.trim();
        if (viuListaOuTabela) (s.paragrafosDepois ??= []).push(p);
        else s.paragrafos.push(p);
      }
    }
    secoes.push(s);
  }
  const atual = GUIAS.find((g) => g.slug === slug);
  if (!atual) throw new Error(`${slug}: guia não existe em src/lib/guias`);
  return {
    slug,
    titulo,
    descricao,
    ...(end[2] ? { termo: end[2] } : atual.termo ? { termo: atual.termo } : {}),
    atualizadoEm: data,
    revisao: "aprovada",
    ...(resumo?.length ? { resumo } : {}),
    secoes,
    ...(faq.length ? { faq } : {}),
    fontes,
    ...(atual.relacionados?.length ? { relacionados: atual.relacionados } : {}),
  };
}

const importados = inicios.map((ini, n) => guiaDoBloco(linhas.slice(ini, n + 1 < inicios.length ? inicios[n + 1] : linhas.length).filter((l) => l !== "---")));
const nomeExport = (slug: string) => slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

for (const g of importados) {
  const antes = RASCUNHOS.find((r) => r.slug === g.slug) ?? GUIAS.find((x) => x.slug === g.slug)!;
  const resumo = `${g.slug}: ${g.secoes.length} seções (antes ${antes.secoes.length}), ${g.faq?.length ?? 0} perguntas, ${g.fontes.length} fontes, título ${g.titulo === antes.titulo ? "igual" : `novo: "${g.titulo}"`}`;
  console.log(resumo);
  if (gravar) {
    const extra = g.slug === "jornada-40-horas-contratos-publicos" ? "// 5.1: texto revisado pelo advogado. Só entra no ar com JORNADA_REGRA_CONFIRMADA=true.\n" : "";
    writeFileSync(join("src/lib/guias", `${g.slug}.ts`), `import type { Guia } from "./tipos";\n\n${extra}export const ${nomeExport(g.slug)}: Guia = ${JSON.stringify(g, null, 2)};\n`);
  }
}
if (avisos.length) console.log("\nAvisos:\n" + avisos.map((a) => `- ${a}`).join("\n"));
console.log(`\n${importados.length} guias ${gravar ? "gravados" : "conferidos (use --gravar para gravar)"}.`);
