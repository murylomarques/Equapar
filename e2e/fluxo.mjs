// Teste ponta a ponta da Equapar num navegador real (Edge), com dados fictícios.
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = path.join(AQUI, "capturas");
await import("node:fs").then((fs) => fs.mkdirSync(SHOTS, { recursive: true }));
const passos = [];
const ok = (m) => {
  passos.push(`OK  ${m}`);
  console.log(`OK  ${m}`);
};

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

async function planilhaExcel(arquivo) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Servente 44h");
  const pct = (r) => (ws.getRow(r).getCell(3).numFmt = "0.00%");
  const rows = [
    ["", "Quantidade de postos", 10],
    ["", "MÓDULO 1 - COMPOSIÇÃO DA REMUNERAÇÃO", ""],
    ["A", "Salário base", 1740],
    ["B", "Adicional de insalubridade", 303.6],
    ["", "Total do Módulo 1", 2043.6],
    ["", "Submódulo 2.1 - 13º salário, férias e adicional de férias", ""],
    ["A", "13º salário", 0.0833],
    ["B", "Férias e adicional de férias", 0.121],
    ["", "Submódulo 2.2 - GPS, FGTS e outras contribuições", ""],
    ["A", "INSS", 0.2],
    ["B", "FGTS", 0.08],
    ["", "Submódulo 2.3 - Benefícios mensais e diários", ""],
    ["A", "Vale-transporte", 220],
    ["B", "Auxílio-alimentação", 440],
    ["", "MÓDULO 3 - PROVISÃO PARA RESCISÃO", ""],
    ["A", "Multa do FGTS", 0.04],
    ["", "MÓDULO 5 - INSUMOS DIVERSOS", ""],
    ["A", "Uniformes", 25],
    ["", "MÓDULO 6 - CUSTOS INDIRETOS, TRIBUTOS E LUCRO", ""],
    ["A", "Custos indiretos", 0.03],
    ["B", "Lucro", 0.05],
    ["C", "PIS", 0.0165],
    ["D", "COFINS", 0.076],
    ["E", "ISS", 0.05],
  ];
  rows.forEach((r) => ws.addRow(r));
  ws.eachRow((row, n) => {
    const v = row.getCell(3).value;
    if (typeof v === "number" && v < 1 && v > 0) pct(n);
  });
  await wb.xlsx.writeFile(arquivo);
}

const hoje = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const mais = (n) => iso(new Date(hoje.getTime() + n * 86400000));

const browser = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "pt-BR" });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
page.on("console", (m) => m.type() === "error" && erros.push(m.text()));

try {
  // Landing e capturas
  await page.goto(BASE);
  await page.screenshot({ path: `${SHOTS}/01-landing.png`, fullPage: false });
  ok("landing abre");

  // Criar conta
  const email = `e2e${Date.now()}@exemplo.local`;
  const senha = "SenhaTeste12345";
  await page.goto(`${BASE}/criar-conta?cnpj=${cnpj()}`);
  await page.fill("#nome", "Pessoa Teste");
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.fill("#razaoSocial", "Empresa Teste E2E (fictícia)");
  await page.check('input[name="termos"]');
  await page.click('button:has-text("Criar conta")');
  await page.waitForURL("**/app/boas-vindas**", { timeout: 30000 });
  ok("conta criada e onboarding aberto");

  // Convenção
  await page.goto(`${BASE}/app/convencoes`);
  await page.fill("#nome-nova", "CCT Teste ES 2026");
  await page.fill("#uf-nova", "ES");
  await page.fill("#ano-nova", String(hoje.getUTCFullYear()));
  await page.selectOption("#mes-nova", "1");
  await page.fill("#dep-nova", `${hoje.getUTCFullYear()}-02-10`);
  await page.fill("#reg-nova", "ES999999/2026");
  await page.click('button:has-text("Cadastrar")');
  await page.getByText("Convenção salva.").waitFor();
  ok("convenção cadastrada");

  // Contrato à mão
  await page.goto(`${BASE}/app/contratos/novo`);
  await page.fill("#numero", "99/2025");
  await page.fill("#orgao", "Órgão Teste");
  await page.fill("#objeto", "Limpeza e conservação com dedicação exclusiva (teste)");
  await page.fill("#municipio", "Cidade Teste");
  await page.fill("#uf", "ES");
  await page.fill("#vigenciaInicio", `${hoje.getUTCFullYear() - 1}-03-01`);
  await page.fill("#vigenciaFim", mais(40));
  await page.fill("#dataProposta", `${hoje.getUTCFullYear() - 1}-02-01`);
  await page.fill("#postos", "10");
  await page.selectOption("#convencaoId", { label: "CCT Teste ES 2026" });
  await page.click('button:has-text("Cadastrar contrato")');
  await page.waitForURL("**/app/contratos/**", { timeout: 30000 });
  await page.getByText(/Pedir até/).first().waitFor();
  ok("contrato cadastrado com selo 'Pedir até'");

  // Hoje mostra a ação
  await page.goto(`${BASE}/app/hoje`);
  await page.getByText("Pedir repactuação").first().waitFor();
  await page.screenshot({ path: `${SHOTS}/02-hoje.png` });
  ok("Hoje mostra 'Pedir repactuação'");
  await page.getByRole("link", { name: "Montar pedido" }).first().click();
  await page.waitForURL("**/app/pedidos/novo**");
  await page.click('button:has-text("Começar")');
  await page.waitForURL("**/passo/1");

  // Passo 1
  const dataBase = await page.inputValue("#dataBase");
  const deposito = await page.inputValue("#dataDeposito");
  if (!dataBase || !deposito) throw new Error(`passo 1 sem data-base (${dataBase}) ou depósito (${deposito})`);
  await page.click('button:has-text("Continuar")');
  await page.waitForURL("**/passo/2");
  ok(`passo 1 (data-base ${dataBase}, depósito ${deposito})`);

  // Passo 2: Excel
  const xlsx = path.join(AQUI, "planilha-teste.xlsx");
  await planilhaExcel(xlsx);
  await page.setInputFiles('input[name="arquivo"]', xlsx);
  await page.getByText(/Lemos \d+ linhas/).waitFor({ timeout: 30000 });
  const lidas = await page.getByText(/Lemos \d+ linhas/).textContent();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/03-passo2.png`, fullPage: true });
  await page.locator(".rodape-assistente button:has-text('Continuar')").click();
  await page.waitForURL("**/passo/3", { timeout: 30000 });
  ok(`passo 2: ${lidas.trim()}`);

  // Passo 3: novo piso
  const salario = page.locator("input.valor").first();
  await salario.fill("1820,00");
  await page.getByText(/Salvo às/).last().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const dif = await page.locator("aside").getByText("Diferença por mês").locator("xpath=following-sibling::dd[1]").textContent();
  await page.screenshot({ path: `${SHOTS}/04-passo3.png`, fullPage: false });
  await page.locator(".rodape-assistente button:has-text('Continuar')").click();
  await page.waitForURL("**/passo/4", { timeout: 30000 });
  ok(`passo 3: diferença por mês ${dif.trim()}`);

  // Passo 4: convenção nova "fora do sistema"
  await page.locator("li", { hasText: "Convenção coletiva nova" }).getByRole("button", { name: "Já tenho fora do sistema" }).click();
  await page.waitForTimeout(1500);
  await page.locator(".rodape-assistente button:has-text('Continuar')").click();
  await page.waitForURL("**/passo/5", { timeout: 30000 });
  ok("passo 4: documentos completos");

  // Passo 5: tentar gerar sem aprovação
  await page.click('button:has-text("Gerar pedido")');
  await page.getByText(/precisa ser aprovada/).waitFor();
  ok("gerar sem aprovação é bloqueado");
  await page.getByRole("link", { name: /aprovar a memória/i }).click();
  await page.waitForURL("**/memoria");
  await page.screenshot({ path: `${SHOTS}/05-memoria.png` });
  await page.click('button:has-text("Aprovar memória")');
  await page.getByText(/Aprovada por/).waitFor();
  ok("memória aprovada pelo Dono");
  await page.goBack();
  await page.goto(page.url().replace(/\/memoria$/, "/passo/5"));
  await page.click('button:has-text("Gerar pedido")');
  await page.waitForURL("**/pronto", { timeout: 30000 });
  await page.getByText("PRONTO PARA PROTOCOLAR").waitFor();
  await page.screenshot({ path: `${SHOTS}/06-pronto.png` });
  ok("pedido gerado: PRONTO PARA PROTOCOLAR");

  // Downloads
  const pedidoUrl = page.url().replace(/\/pronto$/, "");
  for (const t of ["oficio.docx", "oficio.pdf", "planilha.xlsx", "memoria.pdf", "pacote.zip"]) {
    const r = await page.request.get(`${pedidoUrl.replace("/app/pedidos", "/api/pedidos")}/arquivos/${t}`);
    if (r.status() !== 200) throw new Error(`download ${t}: ${r.status()}`);
  }
  ok("5 arquivos baixam (Word, PDF, Excel, PDF, ZIP)");

  // Protocolo -> resposta -> apostilamento -> cobrança -> recebido
  await page.fill("#protocoloNumero", "TESTE-123/2026");
  await page.click('button:has-text("Registrar protocolo")');
  await page.getByText(/Aguardando o órgão/).first().waitFor();
  ok("protocolo registrado");
  await page.reload();
  await page.click('button:has-text("Registrar resposta")');
  await page.getByText("DEFERIDO", { exact: true }).waitFor();
  ok("deferido (carimbo DEFERIDO)");
  await page.click('button:has-text("Registrar apostilamento")');
  await page.locator("#notaFiscal").waitFor();
  await page.fill("#notaFiscal", "NF 555");
  await page.click('button:has-text("Gerar cobrança da diferença")');
  await page.locator("#valorRecebido").waitFor();
  await page.click('button:has-text("Marcar como recebido")');
  await page.getByText("RECEBIDO", { exact: true }).waitFor();
  await page.screenshot({ path: `${SHOTS}/07-recebido.png` });
  ok("recebido (carimbo RECEBIDO)");

  // Avisos simulados
  await page.goto(`${BASE}/app/avisos`);
  await page.getByText(/Protocolado: contrato 99\/2025/).first().waitFor();
  await page.getByText(/Deferido: contrato 99\/2025/).first().waitFor();
  ok("avisos de protocolo e deferimento registrados (simulação)");

  // Prorrogação
  await page.goto(`${BASE}/app/carteira`);
  await page.getByRole("link", { name: "99/2025" }).click();
  await page.waitForURL("**/app/contratos/**");
  await page.goto(page.url().split("?")[0] + "/prorrogacao");
  await page.getByText("A convenção ainda não saiu").waitFor();
  ok("tela de decisão de prorrogação com os 3 casos");

  // Celular
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", isMobile: true, hasTouch: true });
  const pm = await mob.newPage();
  await pm.goto(BASE);
  await pm.screenshot({ path: `${SHOTS}/08-landing-celular.png` });
  const larguraDoc = await pm.evaluate(() => document.documentElement.scrollWidth);
  if (larguraDoc > 390) throw new Error(`rolagem horizontal no celular: ${larguraDoc}px`);
  await pm.goto(`${BASE}/demonstracao`);
  await pm.waitForURL("**/app/hoje");
  await pm.screenshot({ path: `${SHOTS}/09-hoje-celular.png` });
  for (const u of ["/app/hoje", "/app/carteira", "/app/a-receber", "/app/pedidos", "/app/convencoes", "/app/avisos", "/app/configuracoes", "/raio-x", "/precos", "/entrar"]) {
    await pm.goto(BASE + u);
    const w = await pm.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) throw new Error(`rolagem horizontal no celular em ${u}: ${w}px`);
  }
  await pm.goto(BASE + "/app/carteira");
  await pm.locator(".cartoes-celular a", { hasText: "Prefeitura Municipal de Exemplo" }).first().click();
  await pm.waitForURL("**/app/contratos/**");
  const wc = await pm.evaluate(() => document.documentElement.scrollWidth);
  if (wc > 390) throw new Error(`rolagem horizontal no celular no contrato: ${wc}px`);
  await pm.screenshot({ path: `${SHOTS}/10-contrato-celular.png` });
  ok("celular sem rolagem horizontal (landing e app)");
  await mob.close();
} catch (e) {
  console.error("FALHOU:", e.message);
  await page.screenshot({ path: `${SHOTS}/zz-falha.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (erros.length) console.log("Erros no console do navegador:\n" + [...new Set(erros)].slice(0, 10).join("\n"));
  await browser.close();
}
