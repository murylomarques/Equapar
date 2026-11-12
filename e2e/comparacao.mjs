// Gera docs/redesenho/comparacao.html: cada tela, antes e depois lado a lado (computador e celular).
// Uso: node e2e/comparacao.mjs   (depois de rodar e2e/capturas.mjs para "antes" e "depois")
import fs from "node:fs";
import path from "node:path";

const PASTA = path.resolve("docs/redesenho");
const ler = (n) => JSON.parse(fs.readFileSync(path.join(PASTA, n, "lista.json"), "utf8"));
const antes = ler("antes");
const depois = ler("depois");

const telas = new Map();
for (const [lado, lista] of [["antes", antes], ["depois", depois]])
  for (const c of lista) {
    const chave = c.num;
    if (!telas.has(chave)) telas.set(chave, { num: c.num, titulo: c.titulo.replace(/ \(parte \d+\)$/, ""), desktop: { antes: [], depois: [] }, celular: { antes: [], depois: [] } });
    telas.get(chave)[c.tamanho][lado].push(`${lado}/${c.arquivo}`);
  }
const ordenadas = [...telas.values()].sort((a, b) => a.num.localeCompare(b.num));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const imgs = (l, alt) => (l.length ? l.map((src) => `<a href="${src}" target="_blank" rel="noopener"><img loading="lazy" src="${src}" alt="${esc(alt)}"></a>`).join("") : `<p class="vazio">Sem captura</p>`);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Equapar: antes e depois</title>
<style>
  :root { --papel:#f6f4ef; --tinta:#1c1c1c; --cinza:#5f5d58; --linha:#dcd8cf; --verde:#1e7a55; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --papel:#17181a; --tinta:#ecebe7; --cinza:#a9a69f; --linha:#34353a; --verde:#4fbf8c; color-scheme: dark; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--papel); color:var(--tinta); font:15px/1.5 system-ui, sans-serif; }
  header { position:sticky; top:0; z-index:2; background:var(--papel); border-bottom:1px solid var(--linha); padding:12px 16px; display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  h1 { font-size:18px; margin:0; }
  .abas button { font:inherit; padding:6px 12px; border:1px solid var(--linha); background:transparent; color:var(--tinta); border-radius:6px; cursor:pointer; }
  .abas button[aria-pressed="true"] { border-color:var(--verde); color:var(--verde); font-weight:600; }
  nav { display:flex; flex-wrap:wrap; gap:6px; font-size:13px; }
  nav a { color:var(--cinza); }
  main { padding:16px; max-width:1800px; margin:0 auto; }
  section { border-top:1px solid var(--linha); padding:24px 0; scroll-margin-top:110px; }
  h2 { font-size:17px; margin:0 0 12px; }
  .par { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px; }
  .lado h3 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--cinza); margin:0 0 6px; }
  .lado img { display:block; width:100%; height:auto; border:1px solid var(--linha); border-radius:6px; margin-bottom:8px; background:#fff; }
  body[data-tam="celular"] .lado img { max-width:390px; }
  body[data-tam="desktop"] .so-celular, body[data-tam="celular"] .so-desktop { display:none; }
  .vazio { color:var(--cinza); font-style:italic; }
  @media (max-width:700px) { .par { grid-template-columns:minmax(0,1fr); } }
</style>
</head>
<body data-tam="desktop">
<header>
  <h1>Equapar: antes e depois</h1>
  <div class="abas" role="group" aria-label="Tamanho da tela">
    <button type="button" data-t="desktop" aria-pressed="true">Computador (1440)</button>
    <button type="button" data-t="celular" aria-pressed="false">Celular (390)</button>
  </div>
  <nav aria-label="Telas">${ordenadas.map((t) => `<a href="#t${t.num}">${t.num}</a>`).join("")}</nav>
</header>
<main>
<p style="color:var(--cinza)">Capturas com dados fictícios. Clique numa imagem para abrir no tamanho real. Páginas muito altas no celular aparecem em partes.</p>
${ordenadas
  .map(
    (t) => `<section id="t${t.num}">
  <h2>${t.num} · ${esc(t.titulo)}</h2>
  ${["desktop", "celular"]
    .map(
      (tam) => `<div class="par so-${tam}">
    <div class="lado"><h3>Antes</h3>${imgs(t[tam].antes, `${t.titulo}, antes, ${tam}`)}</div>
    <div class="lado"><h3>Depois</h3>${imgs(t[tam].depois, `${t.titulo}, depois, ${tam}`)}</div>
  </div>`,
    )
    .join("\n  ")}
</section>`,
  )
  .join("\n")}
</main>
<script>
  document.querySelectorAll(".abas button").forEach((b) => b.addEventListener("click", () => {
    document.body.dataset.tam = b.dataset.t;
    document.querySelectorAll(".abas button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(PASTA, "comparacao.html"), html);
console.log(`comparacao.html: ${ordenadas.length} telas`);
