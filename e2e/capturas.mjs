// Capturas de todas as rotas em 1440×900 e 390×844, com dados fictícios.
// Uso: node e2e/capturas.mjs <pasta-de-saida>   (servidor no ar em BASE_URL, padrão http://localhost:3000)
// Cria dados temporários (pedido em andamento, Raio-X de exemplo, conta de assessoria) e remove no fim.
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SAIDA = path.resolve(process.argv[2] ?? "docs/redesenho/capturas");
const SENHA_DONO = process.env.SENHA_DONO; // senha impressa pelo seed (npm run db:seed)
if (!SENHA_DONO) throw new Error("Defina SENHA_DONO com a senha do dono@exemplo.local impressa pelo seed.");
const CNPJ_FICT = "12345678000195";
fs.mkdirSync(SAIDA, { recursive: true });

async function preparar() {
  const base = await db.pedido.findFirst({ where: { estado: "PROTOCOLADO", contrato: { empresa: { exemplo: true, conta: { demo: false } } } } });
  const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false } } } });
  const c19 = await db.contrato.findFirst({ where: { numero: "19/2025", empresa: { exemplo: true, conta: { demo: false } } } });
  const deferido = await db.pedido.findFirst({ where: { estado: "DEFERIDO", contrato: { empresa: { exemplo: true, conta: { demo: false } } } } });
  await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: "EM_ANALISE" } });
  const andamento = await db.pedido.create({
    data: {
      contratoId: c45.id, estado: "EM_ANALISE", passoAtual: 5, convencaoId: base.convencaoId, dataBase: base.dataBase, dataDeposito: base.dataDeposito,
      planilhaAntes: base.planilhaAntes, planilhaAgora: base.planilhaAgora, checklist: { convencao_nova: "ANEXADO", planilha_atual: "ANEXADO" }, linhasNaoLidas: [],
    },
  });
  const hoje = new Date();
  const d = (n) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()) + n * 86400000).toISOString().slice(0, 10);
  const c = (n, orgao, objeto, fim) => ({ controle: `EXEMPLO-${n}`, numero: n, orgao, orgaoCnpj: "", uf: "ES", municipio: "Cidade Exemplo", esfera: "M", objeto, inicio: d(-300), fim, valorGlobal: null, link: "https://pncp.gov.br", sugereMaoDeObra: true });
  const resultado = {
    cnpj: CNPJ_FICT, razaoSocial: "EMPRESA EXEMPLO LIMPEZA LTDA (FICTÍCIA)", consultadoEm: new Date().toISOString(), fonte: "cache",
    contratos: [
      c("45/2025", "Prefeitura Municipal de Exemplo", "Serviços contínuos de limpeza e conservação predial com dedicação exclusiva de mão de obra (exemplo)", d(23)),
      c("12/2024", "Tribunal Regional Exemplo", "Limpeza, asseio e conservação das unidades do tribunal (exemplo)", d(120)),
      c("07/2025", "Universidade Federal Exemplo", "Serviços de limpeza e conservação nos campi (exemplo)", d(600)),
    ],
  };
  await db.raioXCache.upsert({ where: { cnpj: CNPJ_FICT }, create: { cnpj: CNPJ_FICT, resultado }, update: { resultado, consultadoEm: new Date() } });
  return { andamento: andamento.id, protocolado: base.id, deferido: deferido.id, c45: c45.id, c19: c19.id };
}

async function limpar() {
  const c45 = await db.contrato.findFirst({ where: { numero: "45/2025", empresa: { exemplo: true, conta: { demo: false } } } });
  if (c45) await db.pedido.deleteMany({ where: { contratoId: c45.id, estado: "EM_ANALISE" } });
  await db.raioXCache.deleteMany({ where: { cnpj: CNPJ_FICT } });
  const us = await db.usuario.findMany({ where: { email: { startsWith: "capturas" } }, include: { membros: true } });
  for (const u of us) for (const m of u.membros) await db.conta.deleteMany({ where: { id: m.contaId } });
  await db.usuario.deleteMany({ where: { email: { startsWith: "capturas" } } });
}

const ID = await preparar();
const ROTAS_SITE = [
  ["01", "Landing", "/"],
  ["02", "Raio-X entrada", "/raio-x"],
  ["03", "Raio-X resultado (exemplo)", `/raio-x?cnpj=${CNPJ_FICT}`],
  ["04", "Raio-X CNPJ invalido", "/raio-x?cnpj=11111111111111"],
  ["05", "Precos", "/precos"],
  ["06", "Para assessorias", "/assessorias"],
  ["07", "Guias", "/guias"],
  ["08", "Guia prorrogacao", "/guias/prorrogacao-sem-perder-a-repactuacao"],
  ["09", "Privacidade", "/privacidade"],
  ["10", "Termos", "/termos"],
  ["11", "Entrar", "/entrar"],
  ["12", "Criar conta", "/criar-conta"],
  ["13", "Nao encontrada", "/pagina-que-nao-existe"],
];
const ROTAS_APP = [
  ["14", "Hoje", "/app/hoje"],
  ["15", "Boas-vindas importar", "/app/boas-vindas"],
  ["16", "Boas-vindas contratos", "/app/boas-vindas?passo=contratos"],
  ["17", "Boas-vindas convencoes", "/app/boas-vindas?passo=convencoes"],
  ["18", "Boas-vindas pronto", "/app/boas-vindas?passo=pronto"],
  ["19", "Carteira", "/app/carteira"],
  ["20", "Carteira prazo 60 dias", "/app/carteira?filtro=prazo60"],
  ["21", "Cadastrar contrato", "/app/contratos/novo"],
  ["22", "Contrato resumo", `/app/contratos/${ID.c45}?aba=resumo`],
  ["23", "Contrato prazos", `/app/contratos/${ID.c45}?aba=prazos`],
  ["24", "Contrato pedidos", `/app/contratos/${ID.c45}?aba=pedidos`],
  ["25", "Contrato documentos", `/app/contratos/${ID.c45}?aba=documentos`],
  ["26", "Contrato historico", `/app/contratos/${ID.c45}?aba=historico`],
  ["27", "Decisao de prorrogacao", `/app/contratos/${ID.c45}/prorrogacao`],
  ["28", "Lista de pedidos", "/app/pedidos"],
  ["29", "Novo pedido", `/app/pedidos/novo?contrato=${ID.c19}`],
  ["30", "Pedido passo 1", `/app/pedidos/${ID.andamento}/passo/1`],
  ["31", "Pedido passo 2", `/app/pedidos/${ID.andamento}/passo/2`],
  ["32", "Pedido passo 3", `/app/pedidos/${ID.andamento}/passo/3`],
  ["33", "Pedido passo 4", `/app/pedidos/${ID.andamento}/passo/4`],
  ["34", "Pedido passo 5", `/app/pedidos/${ID.andamento}/passo/5`],
  ["35", "Memoria de calculo", `/app/pedidos/${ID.andamento}/memoria`],
  ["36", "Pedido protocolado", `/app/pedidos/${ID.protocolado}/pronto`],
  ["37", "Pedido deferido", `/app/pedidos/${ID.deferido}/pronto`],
  ["38", "A receber", "/app/a-receber"],
  ["39", "Convencoes", "/app/convencoes"],
  ["40", "Avisos", "/app/avisos"],
  ["41", "Busca", "/app/busca?q=Exemplo"],
  ["43", "Config empresa", "/app/configuracoes?aba=empresa"],
  ["44", "Config pessoas", "/app/configuracoes?aba=pessoas"],
  ["45", "Config avisos", "/app/configuracoes?aba=avisos"],
  ["46", "Config cobranca", "/app/configuracoes?aba=cobranca"],
  ["47", "Config seguranca", "/app/configuracoes?aba=seguranca"],
  ["48", "Config dados", "/app/configuracoes?aba=dados"],
];

const browser = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true });
const TAMANHOS = [
  { nome: "desktop", viewport: { width: 1440, height: 900 } },
  { nome: "celular", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const lista = [];

async function foto(page, num, titulo, url, tam, acao) {
  if (url) await page.goto(BASE + url, { waitUntil: "networkidle" });
  if (acao) await acao(page);
  if (tam.nome === "celular") await page.addStyleTag({ content: ".app-inferior{position:static!important}" });
  // Captura de página inteira não pinta seções com content-visibility fora da tela; para a foto, desliga.
  await page.addStyleTag({ content: ".revelar.secao{content-visibility:visible!important}" });
  await page.waitForTimeout(600);
  const arquivo = `${num}-${titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}-${tam.nome}.png`;
  // O navegador não captura mais de ~16 mil pixels de altura de uma vez (no celular, com densidade 2,
  // isso dá 8 mil px de página). Páginas mais altas saem em partes: -parte1, -parte2…
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  const largura = tam.viewport.width;
  const maximo = Math.floor(15000 / (tam.deviceScaleFactor ?? 1));
  if (altura <= maximo) {
    await page.screenshot({ path: path.join(SAIDA, arquivo), fullPage: true });
    lista.push({ num, titulo, tamanho: tam.nome, arquivo });
  } else {
    for (let i = 0, y = 0; y < altura; i++, y += maximo) {
      const parte = arquivo.replace(/\.png$/, `-parte${i + 1}.png`);
      await page.screenshot({ path: path.join(SAIDA, parte), fullPage: true, clip: { x: 0, y, width: largura, height: Math.min(maximo, altura - y) } });
      lista.push({ num, titulo: `${titulo} (parte ${i + 1})`, tamanho: tam.nome, arquivo: parte });
    }
  }
}

async function entrar(page, email, senha) {
  await page.goto(BASE + "/entrar");
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**");
}

try {
  for (const tam of TAMANHOS) {
    const ctxOpts = { viewport: tam.viewport, locale: "pt-BR", isMobile: tam.isMobile, hasTouch: tam.hasTouch, deviceScaleFactor: tam.deviceScaleFactor };
    const site = await (await browser.newContext(ctxOpts)).newPage();
    for (const [n, t, u] of ROTAS_SITE) await foto(site, n, t, u, tam);
    const app = await (await browser.newContext(ctxOpts)).newPage();
    await entrar(app, "dono@exemplo.local", SENHA_DONO);
    for (const [n, t, u] of ROTAS_APP) await foto(app, n, t, u, tam);
    await foto(app, "42", "Menu da conta", "/app/hoje", tam, (p) => p.locator('[aria-label^="Conta"]').first().click());
    // assessoria temporária
    const ass = await (await browser.newContext(ctxOpts)).newPage();
    await ass.goto(BASE + "/criar-conta?tipo=assessoria");
    await ass.fill("#nome", "Rafael (exemplo)");
    await ass.fill("#email", `capturas${Date.now()}@exemplo.local`);
    await ass.fill("#senha", "SenhaTeste12345");
    await ass.fill("#razaoSocial", "Assessoria Exemplo (fictícia)");
    await ass.check('input[name="termos"]');
    await ass.click('button[type="submit"]');
    await ass.waitForURL("**/app/clientes");
    await foto(ass, "49", "Assessoria clientes vazio", null, tam);
    for (const [c, nome] of [["11222333000181", "Cliente Exemplo Um (fictício)"], ["33444555000140", "Cliente Exemplo Dois (fictício)"]]) {
      await ass.getByLabel("CNPJ do cliente").fill(c);
      await ass.getByLabel(/^Razão social/).fill(nome);
      const imp = ass.locator('input[name="importar"]');
      if (await imp.isChecked()) await imp.uncheck({ force: true });
      await ass.locator('button[type="submit"]', { hasText: /Adicionar cliente/ }).click();
      await ass.waitForTimeout(1800);
    }
    await foto(ass, "50", "Assessoria clientes", "/app/clientes", tam);
    const demo = await (await browser.newContext(ctxOpts)).newPage();
    await demo.goto(BASE + "/demonstracao");
    await demo.getByRole("button", { name: "Entrar na demonstração" }).click();
    await demo.waitForURL("**/app/hoje");
    await foto(demo, "51", "Demonstracao", null, tam);
    console.log("ok", tam.nome);
  }
} finally {
  fs.writeFileSync(path.join(SAIDA, "lista.json"), JSON.stringify(lista, null, 2));
  await browser.close();
  await limpar();
  await db.$disconnect();
}
console.log("capturas:", lista.length, "em", SAIDA);
