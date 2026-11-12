// Teste ponta a ponta da Equapar num navegador real (Edge), com dados fictícios.
// Uso: node e2e/fluxo.mjs [desktop|celular]   (servidor em BASE_URL, padrão http://localhost:3000)
// Cobre: Raio-X, primeiros passos, cadastrar contrato, pedido em 5 passos, protocolo, deferido,
// recebido e configurações de avisos. Remove no fim a conta e o Raio-X de exemplo que criou.
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TAM = process.argv[2] === "celular" ? "celular" : "desktop";
const SHOTS = path.join(AQUI, "capturas", TAM);
fs.mkdirSync(SHOTS, { recursive: true });
const CELULAR = TAM === "celular";
const ok = (m) => console.log(`OK  [${TAM}] ${m}`);

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
  ws.eachRow((row) => {
    const v = row.getCell(3).value;
    if (typeof v === "number" && v < 1 && v > 0) row.getCell(3).numFmt = "0.00%";
  });
  await wb.xlsx.writeFile(arquivo);
}

const hoje = new Date();
const ano = hoje.getUTCFullYear();
const br = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const daqui = (n) => br(new Date(hoje.getTime() + n * 86400000));

const CNPJ_RAIOX = "12345678000195"; // fictício, com dígitos válidos
const email = `e2e-${TAM}-${Date.now()}@exemplo.local`;
const senha = "SenhaTeste12345";

const browser = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true });
const ctx = await browser.newContext(
  CELULAR
    ? { viewport: { width: 390, height: 844 }, locale: "pt-BR", isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1440, height: 900 }, locale: "pt-BR" },
);
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));

async function semRolagemLateral(onde) {
  if (!CELULAR) return;
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > 391) throw new Error(`rolagem horizontal no celular em ${onde}: ${w}px`);
}
const continuar = () => page.locator(".rodape-assistente").getByRole("button", { name: "Continuar" }).click();
// Clica e, se abrir a janela de confirmação, confirma nela.
async function clicarConfirmando(nome) {
  await page.getByRole("button", { name: nome }).first().click();
  const janela = page.getByRole("dialog");
  try {
    await janela.waitFor({ state: "visible", timeout: 1500 });
    await janela.getByRole("button").last().click();
  } catch {}
}
const toast = (texto) => page.getByRole("status").filter({ hasText: texto }).first().waitFor();

try {
  // ---------------------------------------------------------------- Raio-X
  const resultado = {
    cnpj: CNPJ_RAIOX, razaoSocial: "EMPRESA EXEMPLO LIMPEZA LTDA (FICTÍCIA)", consultadoEm: new Date().toISOString(), fonte: "cache",
    contratos: [
      { controle: "EXEMPLO-1", numero: "45/2025", orgao: "Prefeitura Municipal de Exemplo", orgaoCnpj: "", uf: "ES", municipio: "Cidade Exemplo", esfera: "M", objeto: "Limpeza e conservação predial com dedicação exclusiva de mão de obra (exemplo)", inicio: `${ano - 1}-03-01`, fim: new Date(hoje.getTime() + 25 * 86400000).toISOString().slice(0, 10), valorGlobal: null, link: "https://pncp.gov.br", sugereMaoDeObra: true },
    ],
  };
  await db.raioXCache.upsert({ where: { cnpj: CNPJ_RAIOX }, create: { cnpj: CNPJ_RAIOX, resultado }, update: { resultado, consultadoEm: new Date() } });
  await page.goto(BASE + "/raio-x");
  const campoCnpj = page.getByLabel("CNPJ da empresa").first();
  await campoCnpj.fill("11111111111111");
  await campoCnpj.blur();
  await page.getByText("Esse CNPJ não existe. Confira os 14 números.").filter({ visible: true }).first().waitFor();
  ok("Raio-X recusa CNPJ inválido com mensagem clara");
  await campoCnpj.fill(CNPJ_RAIOX);
  if ((await campoCnpj.inputValue()) !== "12.345.678/0001-95") throw new Error("máscara do CNPJ não aplicada");
  await page.getByRole("button", { name: "Ver meus contratos" }).first().click();
  await page.waitForURL(`**/raio-x?cnpj=${CNPJ_RAIOX}`);
  await page.getByText("EMPRESA EXEMPLO LIMPEZA LTDA (FICTÍCIA)").filter({ visible: true }).first().waitFor({ timeout: 30000 });
  await page.getByText("Prefeitura Municipal de Exemplo").filter({ visible: true }).first().waitFor();
  await semRolagemLateral("/raio-x resultado");
  await page.screenshot({ path: `${SHOTS}/01-raio-x.png`, fullPage: true });
  ok("Raio-X mostra a empresa e os contratos (resultado em cache, fictício)");

  // ---------------------------------------------------------------- Criar conta e primeiros passos
  await page.goto(`${BASE}/criar-conta?cnpj=${cnpj()}`);
  await page.getByLabel("Seu nome").fill("Pessoa Teste");
  await page.getByLabel("E-mail de trabalho").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByLabel(/^Razão social/).fill("Empresa Teste E2E (fictícia)");
  await page.locator('input[name="termos"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/app/boas-vindas**", { timeout: 30000 });
  await page.getByRole("button", { name: "Importar meus contratos" }).waitFor();
  await semRolagemLateral("/app/boas-vindas");
  ok("conta criada; primeiros passos abre com a importação do PNCP");

  // Confirmação do e-mail (C7): sem ela, a conta não recebe avisos
  await page.getByText(/Confirme seu e-mail/).first().waitFor();
  const conf = await db.aviso.findFirst({ where: { destino: email, tipo: "CONFIRMAR_EMAIL" }, orderBy: { enviadoEm: "desc" } });
  await page.goto(conf.corpo.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, BASE));
  await page.getByText("E-mail confirmado").first().waitFor();
  ok("e-mail confirmado pelo link (e-mail simulado)");

  // Convenção
  await page.goto(`${BASE}/app/convencoes`);
  const formConv = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar convenção" }) });
  await formConv.getByLabel("Nome").fill(`CCT Teste ES ${ano}`);
  await formConv.getByLabel("Cidade").fill("Cidade Teste");
  await formConv.getByLabel("UF").selectOption("ES");
  await formConv.getByLabel("Mês da data-base").selectOption("1");
  await formConv.getByLabel("Ano").fill(String(ano));
  await formConv.getByLabel("Data do depósito (Mediador)").fill(`10/02/${ano}`);
  await formConv.getByLabel("Número do registro").fill(`ES999999/${ano}`);
  await formConv.getByRole("button", { name: "Cadastrar convenção" }).click();
  await page.getByText(`CCT Teste ES ${ano}`, { exact: true }).filter({ visible: true }).first().waitFor();
  await semRolagemLateral("/app/convencoes");
  ok("convenção cadastrada");

  // ---------------------------------------------------------------- Cadastrar contrato
  await page.goto(`${BASE}/app/boas-vindas`);
  await page.getByRole("link", { name: "Cadastrar à mão" }).click();
  await page.waitForURL("**/app/contratos/novo");
  await page.getByRole("button", { name: "Cadastrar contrato" }).click();
  await page.getByText(/Falta corrigir \d+ campos/).filter({ visible: true }).first().waitFor();
  ok("enviar o contrato vazio mostra o resumo de erros");
  await page.getByLabel("Número do contrato").fill("99/2025");
  await page.getByLabel("Órgão contratante").fill("Órgão Teste (fictício)");
  await page.getByLabel("Objeto").fill("Limpeza e conservação com dedicação exclusiva (teste)");
  await page.getByLabel("Cidade").fill("Cidade Teste");
  await page.getByLabel("UF").selectOption("ES");
  await page.getByLabel("Início da vigência").fill(`01/03/${ano - 1}`);
  await page.getByLabel("Fim da vigência").fill(daqui(40));
  await page.getByLabel("Data da proposta").fill(`01/02/${ano - 1}`);
  await page.getByLabel("Postos de trabalho").fill("10");
  await page.getByLabel("Valor mensal").fill("58805,66");
  await page.getByRole("combobox", { name: "Convenção coletiva" }).fill("CCT Teste");
  await page.getByRole("option", { name: new RegExp(`CCT Teste ES ${ano}`) }).click();
  await semRolagemLateral("/app/contratos/novo");
  await page.screenshot({ path: `${SHOTS}/02-contrato-novo.png`, fullPage: true });
  await page.getByRole("button", { name: "Cadastrar contrato" }).click();
  await page.waitForURL(/\/app\/contratos\/(?!novo)[^/?]+/, { timeout: 30000 });
  await page.getByText(/Pedir até/).filter({ visible: true }).first().waitFor();
  await semRolagemLateral("contrato");
  ok("contrato cadastrado com selo 'Pedir até'");

  // Primeiros passos: convenção sugerida e tela final
  await page.goto(`${BASE}/app/boas-vindas?passo=convencoes`);
  await page.getByRole("radio", { name: new RegExp(`CCT Teste ES ${ano}`) }).check();
  await continuar();
  await page.waitForURL("**passo=pronto");
  await page.getByText(/Sua carteira tem 1 contrato/).filter({ visible: true }).first().waitFor();
  ok("primeiros passos concluídos: 'Sua carteira tem 1 contrato…'");

  // ---------------------------------------------------------------- Pedido em 5 passos
  await page.goto(`${BASE}/app/hoje`);
  await page.getByText("Pedir repactuação").filter({ visible: true }).first().waitFor();
  await semRolagemLateral("/app/hoje");
  await page.screenshot({ path: `${SHOTS}/03-hoje.png`, fullPage: true });
  ok("Hoje mostra 'Pedir repactuação'");
  await page.getByRole("link", { name: "Montar pedido" }).first().click();
  await page.waitForURL("**/app/pedidos/novo**");
  await page.getByRole("button", { name: "Começar" }).click();
  await page.waitForURL("**/passo/1", { timeout: 30000 });

  const dataBase = await page.getByLabel("Data-base").inputValue();
  const deposito = await page.getByLabel("Data do depósito da convenção").inputValue();
  if (!dataBase || !deposito) throw new Error(`passo 1 sem data-base (${dataBase}) ou depósito (${deposito})`);
  await semRolagemLateral("passo 1");
  await continuar();
  await page.waitForURL("**/passo/2", { timeout: 30000 });
  ok(`passo 1 (data-base ${dataBase}, depósito ${deposito})`);

  const xlsx = path.join(AQUI, "capturas", `planilha-teste-${TAM}.xlsx`);
  await planilhaExcel(xlsx);
  await page.locator('input[type="file"]').first().setInputFiles(xlsx);
  await page.getByText(/Lemos \d+ linhas/).filter({ visible: true }).first().waitFor({ timeout: 30000 });
  const lidas = (await page.getByText(/Lemos \d+ linhas/).first().textContent()).trim();
  await semRolagemLateral("passo 2");
  await continuar();
  await page.waitForURL("**/passo/3", { timeout: 30000 });
  ok(`passo 2: ${lidas}`);

  // Passo 3: novo piso, sem fonte é barrado; com fonte, segue
  const mostrarTodas = page.getByRole("button", { name: /Mostrar todas/ });
  if (await mostrarTodas.count()) await mostrarTodas.first().click();
  await page.getByLabel("Valor em R$ de Salário base").first().fill("1820,00");
  await page.getByText(/^Salvo/).filter({ visible: true }).first().waitFor({ timeout: 15000 });
  await continuar();
  await page.getByText(/fonte/i).filter({ visible: true }).first().waitFor();
  if (!page.url().endsWith("/passo/3")) throw new Error("passo 3 aceitou linha alterada sem fonte");
  await page.getByLabel("Fonte de Salário base").first().fill(`CCT Teste ES ${ano}, cláusula 4ª`);
  await page.waitForTimeout(400);
  await page.getByText(/^Salvo/).filter({ visible: true }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const memoria = page.getByRole("complementary", { name: "Memória de cálculo" });
  const dif = (await memoria.locator("dt", { hasText: "Diferença por mês" }).locator("xpath=following-sibling::dd[1]").textContent()).trim();
  await semRolagemLateral("passo 3");
  await page.screenshot({ path: `${SHOTS}/04-passo3.png`, fullPage: true });
  await continuar();
  await page.waitForURL("**/passo/4", { timeout: 30000 });
  ok(`passo 3: linha sem fonte é barrada; diferença por mês ${dif}`);

  await page.locator("li", { hasText: "Convenção coletiva nova" }).getByRole("button", { name: "Já tenho fora do sistema" }).click();
  await page.getByText("Tudo pronto").waitFor();
  await semRolagemLateral("passo 4");
  await continuar();
  await page.waitForURL("**/passo/5", { timeout: 30000 });
  ok("passo 4: documentos completos");

  await page.getByRole("button", { name: "Gerar pedido" }).click();
  await page.getByText(/precisa ser aprovada/).filter({ visible: true }).first().waitFor();
  ok("gerar sem a memória aprovada é bloqueado");
  await page.getByRole("link", { name: /aprovar a memória/i }).click();
  await page.waitForURL("**/memoria");
  await semRolagemLateral("memória");
  await clicarConfirmando("Aprovar memória");
  await page.getByText(/Aprovada por/).filter({ visible: true }).first().waitFor();
  ok("memória aprovada pelo Dono");
  await page.goto(page.url().replace(/\/memoria$/, "/passo/5"));
  await page.getByRole("button", { name: "Gerar pedido" }).click();
  await page.waitForURL("**/pronto", { timeout: 60000 });
  await page.getByText("PRONTO PARA PROTOCOLAR").filter({ visible: true }).first().waitFor();
  await semRolagemLateral("pronto");
  await page.screenshot({ path: `${SHOTS}/05-pronto.png`, fullPage: true });
  ok("pedido gerado: PRONTO PARA PROTOCOLAR");

  const apiPedido = page.url().replace(/\/pronto$/, "").replace("/app/pedidos", "/api/pedidos");
  for (const t of ["oficio.docx", "oficio.pdf", "planilha.xlsx", "memoria.pdf", "pacote.zip"]) {
    const r = await page.request.get(`${apiPedido}/arquivos/${t}`);
    if (r.status() !== 200) throw new Error(`download ${t}: ${r.status()}`);
  }
  ok("5 arquivos baixam (Word, PDF, Excel, PDF, ZIP)");

  // ---------------------------------------------------------------- Protocolo, deferido, recebido
  await page.getByLabel("Número do protocolo").fill("TESTE-123/2026");
  await clicarConfirmando("Registrar protocolo");
  await page.getByText(/Aguardando o órgão/).filter({ visible: true }).first().waitFor();
  ok("protocolo registrado");
  await clicarConfirmando("Registrar resposta");
  await page.getByText("DEFERIDO", { exact: true }).filter({ visible: true }).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/06-deferido.png`, fullPage: true });
  ok("deferido (carimbo DEFERIDO)");
  await clicarConfirmando("Registrar apostilamento");
  await page.getByLabel("Número da nota fiscal").fill("NF 555");
  await clicarConfirmando("Gerar cobrança da diferença");
  await page.getByLabel("Valor recebido").waitFor();
  await clicarConfirmando("Marcar como recebido");
  await page.getByText("RECEBIDO", { exact: true }).filter({ visible: true }).first().waitFor();
  await semRolagemLateral("recebido");
  await page.screenshot({ path: `${SHOTS}/07-recebido.png`, fullPage: true });
  ok("recebido (carimbo RECEBIDO)");

  await page.goto(`${BASE}/app/avisos`);
  await page.getByText(/Protocolado: contrato 99\/2025/).filter({ visible: true }).first().waitFor();
  await page.getByText(/Deferido: contrato 99\/2025/).filter({ visible: true }).first().waitFor();
  ok("avisos de protocolo e deferimento registrados (simulação)");

  // ---------------------------------------------------------------- Configurações de avisos
  await page.goto(`${BASE}/app/configuracoes?aba=avisos`);
  const prazo = page.getByLabel("Prazos (60, 30 e 7 dias)");
  const opcoes = await prazo.locator("option").evaluateAll((os) => os.map((o) => o.value));
  const atual = await prazo.inputValue();
  const outra = opcoes.find((v) => v !== atual);
  await prazo.selectOption(outra);
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await toast("Preferências de aviso salvas.");
  await page.reload();
  if ((await page.getByLabel("Prazos (60, 30 e 7 dias)").inputValue()) !== outra) throw new Error("preferência de aviso não ficou salva");
  await semRolagemLateral("configurações de avisos");
  ok(`configurações de avisos: canal de prazos mudou de ${atual} para ${outra} e ficou salvo`);

  // Prorrogação
  await page.goto(`${BASE}/app/carteira`);
  await page.getByRole("link", { name: /99\/2025/ }).first().click();
  await page.waitForURL(/\/app\/contratos\/[^/?]+/);
  await page.goto(page.url().split("?")[0] + "/prorrogacao");
  await page.getByText("A convenção ainda não saiu").filter({ visible: true }).first().waitFor();
  await semRolagemLateral("prorrogação");
  ok("decisão de prorrogação com os 3 casos");
} catch (e) {
  console.error(`FALHOU [${TAM}]:`, e.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOTS}/zz-falha.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  const unicos = [...new Set(erros)];
  if (unicos.length) {
    console.log(`Erros no console do navegador [${TAM}]:\n` + unicos.slice(0, 10).join("\n"));
    process.exitCode = 1;
  }
  await browser.close();
  // limpeza: só o que este teste criou (conta de teste e Raio-X fictício)
  const u = await db.usuario.findUnique({ where: { email }, include: { membros: true } });
  if (u) {
    for (const m of u.membros) await db.conta.deleteMany({ where: { id: m.contaId } }).catch(() => {});
    await db.usuario.deleteMany({ where: { id: u.id } }).catch(() => {});
  }
  await db.raioXCache.deleteMany({ where: { cnpj: CNPJ_RAIOX } });
  await db.$disconnect();
}
