// S3: cabeçalhos de segurança (o equivalente a `curl -I`) e páginas sem violação de CSP no navegador.
import { BASE, navegador, novaPagina, entrarComoDono, conferir, fim } from "./util.mjs";

const esperados = {
  "x-frame-options": /^DENY$/i,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "x-content-type-options": /^nosniff$/,
  "permissions-policy": /camera=\(\)/,
  "content-security-policy": /frame-ancestors 'none'/,
};
for (const rota of ["/", "/precos", "/entrar", "/raio-x", "/demonstracao"]) {
  const r = await fetch(BASE + rota, { redirect: "manual" });
  const faltam = Object.entries(esperados).filter(([k, re]) => !re.test(r.headers.get(k) ?? "")).map(([k]) => k);
  conferir(!faltam.length, `${rota}: cabeçalhos de segurança${faltam.length ? ` (faltam: ${faltam.join(", ")})` : ""}`);
  conferir(!r.headers.get("x-powered-by"), `${rota}: sem X-Powered-By`);
}
const din = await fetch(BASE + "/entrar");
conferir(/'nonce-[^']+'/.test(din.headers.get("content-security-policy") ?? ""), "página dinâmica (/entrar) usa CSP com nonce");

// No navegador: nenhuma violação de CSP ao abrir as telas principais
const b = await navegador();
try {
  const violacoes = [];
  const ouvir = (p) => p.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violacoes.push(`${p.url()}: ${m.text().slice(0, 140)}`));
  const pub = await novaPagina(await b.newContext());
  ouvir(pub);
  for (const rota of ["/", "/precos", "/raio-x", "/entrar", "/criar-conta"]) await pub.goto(BASE + rota, { waitUntil: "networkidle" });
  const app = await entrarComoDono(await b.newContext());
  ouvir(app);
  for (const rota of ["/app/hoje", "/app/carteira", "/app/convencoes", "/app/configuracoes?aba=seguranca"]) await app.goto(BASE + rota, { waitUntil: "networkidle" });
  conferir(violacoes.length === 0, `nenhuma violação de CSP no navegador${violacoes.length ? `:\n  ${violacoes.slice(0, 5).join("\n  ")}` : ""}`);
} finally {
  await fim(b);
}
