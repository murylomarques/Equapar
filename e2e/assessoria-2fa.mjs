// Assessoria (vários clientes, seletor, visão "Todos os clientes") e verificação em duas etapas.
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const OTPAuth = require("otpauth");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ok = (m) => console.log(`OK  ${m}`);
function cnpj() {
  const b = Array.from({ length: 12 }, (_, i) => (i < 8 ? Math.floor(Math.random() * 10) : [0, 0, 0, 1][i - 8]));
  const dv = (n) => {
    const p = n.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = n.reduce((s, x, i) => s + x * p[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(b);
  return [...b, d1, dv([...b, d1])].join("");
}

const browser = await chromium.launch({ headless: true, ...(process.env.NAVEGADOR ? { channel: process.env.NAVEGADOR } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
try {
  const email = `assess${Date.now()}@exemplo.local`;
  const senha = "SenhaTeste12345";
  await page.goto(`${BASE}/criar-conta?tipo=assessoria`);
  await page.fill("#nome", "Assessor Teste");
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.fill("#razaoSocial", "Assessoria Teste (fictícia)");
  await page.check('input[name="termos"]');
  await page.click('button:has-text("Criar conta")');
  await page.waitForURL("**/app/clientes", { timeout: 30000 });
  ok("conta de assessoria criada, abre em Clientes");

  for (const nome of ["Cliente Um (fictício)", "Cliente Dois (fictício)"]) {
    await page.getByLabel("CNPJ do cliente").fill(cnpj());
    await page.getByLabel(/^Razão social/).fill(nome);
    const imp = page.locator('input[name="importar"]');
    if (await imp.isChecked()) await imp.uncheck({ force: true });
    await page.getByRole("button", { name: /Adicionar cliente/ }).click();
    await page.getByText(nome).filter({ visible: true }).first().filter({ visible: true }).first().waitFor();
  }
  ok("dois clientes adicionados");

  const opcoes = await page.locator("#seletor-empresa option").allTextContents();
  if (!opcoes.includes("Todos os clientes") || opcoes.length !== 3) throw new Error(`seletor: ${opcoes}`);
  await page.selectOption("#seletor-empresa", { label: "Cliente Dois (fictício)" });
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/app/contratos/novo`);
  ok("seletor de cliente com 'Todos os clientes' + 2 clientes");

  // 2FA
  await page.goto(`${BASE}/app/configuracoes?aba=seguranca`);
  await page.click('button:has-text("Ativar verificação em duas etapas")');
  const uri = await page.locator("details code").textContent();
  const totp = OTPAuth.URI.parse(uri.trim());
  await page.fill("#cod-on", totp.generate());
  await page.click('button:has-text("Confirmar")');
  await page.getByText("Ativada.").filter({ visible: true }).first().waitFor();
  const codigosRec = (await page.locator("ul li").allInnerTexts()).filter((t) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(t.trim()));
  if (codigosRec.length !== 10) throw new Error(`esperava 10 códigos de recuperação, vieram ${codigosRec.length}`);
  ok("2FA ativada; 10 códigos de recuperação mostrados uma vez");

  // C8: trocar de aplicativo sem o código atual não desliga nada
  await page.reload();
  await page.getByRole("button", { name: "Trocar de aplicativo" }).click();
  await page.locator("#troca-cod").locator("xpath=ancestor::form").getByRole("button", { name: "Continuar" }).click();
  await page.getByText(/digite o código atual do aplicativo ou a sua senha/).filter({ visible: true }).first().waitFor();
  await page.reload();
  await page.getByText("Ativada.").filter({ visible: true }).first().waitFor();
  ok("trocar de aplicativo sem código é recusado e as duas etapas continuam ativas");

  // sair e entrar de novo: pede código
  await page.locator('[aria-label^="Conta"]').first().click();
  await page.getByRole("menuitem", { name: "Sair" }).or(page.getByRole("button", { name: "Sair" })).first().click();
  await page.waitForURL(BASE + "/");
  await page.goto(`${BASE}/entrar`);
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL("**/entrar/2fa**");
  await page.goto(`${BASE}/app/hoje`);
  await page.waitForURL("**/entrar/2fa**");
  ok("com 2FA pendente, /app redireciona para o código");
  await page.fill("#codigo", "000000");
  await page.click('button:has-text("Confirmar")');
  await page.getByText(/Código não confere/).filter({ visible: true }).first().waitFor();
  await page.fill("#codigo", totp.generate());
  await page.click('button:has-text("Confirmar")');
  await page.waitForURL("**/app/hoje", { timeout: 30000 });
  ok("código errado recusado; código certo entra");

  // C8: código de recuperação entra uma vez só
  for (const [tentativa, deveEntrar] of [[1, true], [2, false]]) {
    const cr = await browser.newContext();
    const pr = await cr.newPage();
    await pr.goto(`${BASE}/entrar`);
    await pr.fill("#email", email);
    await pr.fill("#senha", senha);
    await pr.click('button:has-text("Entrar")');
    await pr.waitForURL("**/entrar/2fa**");
    await pr.fill("#codigo", codigosRec[0]);
    await pr.click('button:has-text("Confirmar")');
    if (deveEntrar) await pr.waitForURL("**/app/hoje", { timeout: 30000 });
    else await pr.getByText(/Código não confere/).filter({ visible: true }).first().waitFor();
    await cr.close();
    void tentativa;
  }
  ok("código de recuperação entra uma vez e é recusado na segunda");

  // senha errada
  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.goto(`${BASE}/entrar`);
  await p2.fill("#email", email);
  await p2.fill("#senha", "errada123456");
  await p2.click('button:has-text("Entrar")');
  await p2.getByText("E-mail ou senha não conferem.").filter({ visible: true }).first().waitFor();
  ok("senha errada recusada");
  await c2.close();
} catch (e) {
  console.error("FALHOU:", e.message);
  await page.screenshot({ path: "e2e/capturas/zz-falha2.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
