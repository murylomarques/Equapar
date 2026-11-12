// Uso só com teclado: pular para o conteúdo, Raio-X, entrar, menu da conta, abas, foco visível em tudo.
// Uso: node e2e/teclado.mjs   (servidor em BASE_URL; conta fictícia dono@exemplo.local)
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SENHA_DONO = process.env.SENHA_DONO; // senha impressa pelo seed (npm run db:seed)
if (!SENHA_DONO) throw new Error("Defina SENHA_DONO com a senha do dono@exemplo.local impressa pelo seed.");
const ok = (m) => console.log(`OK  ${m}`);
const browser = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" })).newPage();

const focado = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    const anel = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), texto: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40), anel, visivel: r.width > 0 && r.height > 0 };
  });

// Percorre a página com Tab e exige anel de foco visível em cada parada
async function percorrer(rota, max = 40) {
  await page.goto(BASE + rota, { waitUntil: "networkidle" });
  const semAnel = [];
  let paradas = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focado();
    if (!f) continue;
    paradas++;
    if (!f.anel || !f.visivel) semAnel.push(`${f.tag} "${f.texto}"`);
  }
  if (semAnel.length) throw new Error(`${rota}: foco sem anel visível em ${[...new Set(semAnel)].join("; ")}`);
  ok(`${rota}: ${paradas} paradas de Tab, todas com anel de foco visível`);
}

try {
  // 1. Pular para o conteúdo
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  let f = await focado();
  if (!/Pular para o conteúdo/.test(f?.texto ?? "")) throw new Error(`primeiro Tab não foi o "Pular para o conteúdo": ${JSON.stringify(f)}`);
  await page.keyboard.press("Enter");
  if (!page.url().endsWith("#conteudo")) throw new Error("Pular para o conteúdo não levou ao conteúdo");
  ok("primeiro Tab mostra 'Pular para o conteúdo' e Enter vai ao conteúdo");

  // 2. Raio-X pelo teclado
  await page.goto(BASE + "/raio-x", { waitUntil: "networkidle" });
  await page.getByLabel("CNPJ da empresa").first().focus();
  await page.keyboard.type("11222333000181");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/raio-x?cnpj=11222333000181", { timeout: 30000 });
  ok("Raio-X: digitar o CNPJ e apertar Enter envia");

  // 3. Entrar só com teclado
  await page.goto(BASE + "/entrar", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail de trabalho").focus();
  await page.keyboard.type("dono@exemplo.local");
  await page.keyboard.press("Tab");
  await page.keyboard.type(SENHA_DONO);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/app/**", { timeout: 30000 });
  ok("entrar: e-mail, Tab, senha, Enter");

  // 4. Menu da conta: abre com Enter, setas navegam, Esc fecha e devolve o foco
  await page.goto(BASE + "/app/hoje", { waitUntil: "networkidle" });
  const conta = page.locator('[aria-label^="Conta"]').first();
  await conta.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor();
  await page.keyboard.press("ArrowDown");
  f = await focado();
  if (!f || !f.anel) throw new Error("seta para baixo no menu não moveu o foco visível");
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "hidden" });
  if (!(await conta.evaluate((el) => el === document.activeElement))) throw new Error("Esc não devolveu o foco ao botão da conta");
  ok("menu da conta: Enter abre, setas navegam, Esc fecha e devolve o foco");

  // 5. Atalho "/" abre a busca
  await page.locator("body").click({ position: { x: 5, y: 600 } });
  await page.keyboard.press("/");
  const naBusca = await page.evaluate(() => document.activeElement?.getAttribute("type") === "search" || /busca/i.test(document.activeElement?.getAttribute("aria-label") ?? "") || document.activeElement?.getAttribute("name") === "q");
  if (!naBusca) throw new Error("'/' não levou o foco à busca");
  ok("atalho '/' leva o foco à busca");

  // 6. Foco visível em todas as paradas das telas principais
  for (const r of ["/", "/precos", "/app/hoje", "/app/carteira", "/app/contratos/novo", "/app/pedidos", "/app/a-receber", "/app/convencoes", "/app/configuracoes?aba=avisos"]) await percorrer(r);
} catch (e) {
  console.error("FALHOU:", e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
}
