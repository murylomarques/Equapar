// C6: a demonstração não pode derrubar visitantes nem a sessão de um cliente real.
// Esperado: todos continuam logados; a demo não encerra a sessão de outro visitante.
import { BASE, SENHA_DONO, db, navegador, novaPagina, conferir, fim } from "./util.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const b = await navegador();

/** Abre a demonstração como um visitante: GET mostra a página; o botão (POST) entra. */
async function abreDemo(ua) {
  const c = await b.newContext({ userAgent: ua });
  const p = await novaPagina(c);
  await p.goto(`${BASE}/demonstracao`);
  const botao = p.getByRole("button", { name: /demonstração/i });
  if (!/\/app\//.test(p.url()) && (await botao.count())) {
    await botao.first().click();
    await p.waitForURL(/\/app\//);
  }
  return { c, p };
}
async function onde(p) {
  await p.goto(`${BASE}/app/hoje`);
  return new URL(p.url()).pathname;
}

try {
  // 1) Dois visitantes com o mesmo navegador
  const v1 = await abreDemo(UA);
  const v2 = await abreDemo(UA);
  conferir((await onde(v1.p)) === "/app/hoje", "visitante 1 continua logado depois que o 2 entra com o mesmo navegador");
  conferir((await onde(v2.p)) === "/app/hoje", "visitante 2 logado");

  // 1b) Demonstração isolada (C6.2): cada visitante tem a própria cópia e pode mexer
  const nomeConv = `CCT do visitante 1 ${Date.now()}`;
  await v1.p.goto(`${BASE}/app/convencoes`);
  const form = v1.p.locator("form", { has: v1.p.getByRole("button", { name: "Cadastrar convenção" }) });
  await form.getByLabel("Nome").fill(nomeConv);
  await form.getByLabel("UF").selectOption("ES");
  await form.getByLabel("Mês da data-base").selectOption("1");
  await form.getByRole("button", { name: "Cadastrar convenção" }).click();
  await v1.p.getByText(nomeConv, { exact: true }).first().waitFor();
  conferir(true, "visitante da demonstração consegue cadastrar (experimentar)");
  await v2.p.goto(`${BASE}/app/convencoes`);
  conferir((await v2.p.getByText(nomeConv, { exact: true }).count()) === 0, "o outro visitante não vê o que o primeiro criou");
  const contasDemo = await db.conta.findMany({ where: { demo: true }, select: { id: true, demoExpiraEm: true } });
  conferir(contasDemo.length >= 2 && contasDemo.every((c) => c.demoExpiraEm > new Date()), `cada visitante ganhou uma conta demo com vencimento (${contasDemo.length})`);
  await v1.p.goto(`${BASE}/app/configuracoes?aba=dados`);
  const enviados = await db.aviso.count({ where: { contaId: { in: contasDemo.map((c) => c.id) }, status: "ENVIADO" } });
  conferir(enviados === 0, "a demonstração não envia mensagem (nenhum aviso ENVIADO)");

  // 2) Visitante da demo tenta encerrar as outras sessões
  const v3 = await abreDemo(UA.replace("141", "140"));
  const v4 = await abreDemo(UA.replace("141", "139"));
  await v4.p.goto(`${BASE}/app/configuracoes?aba=seguranca`);
  const enc = v4.p.getByRole("button", { name: "Encerrar as outras sessões" });
  if ((await enc.count()) && (await enc.isEnabled())) {
    await enc.click();
    const j = v4.p.getByRole("dialog");
    if (await j.isVisible().catch(() => false)) await j.getByRole("button", { name: /Encerrar/ }).last().click();
    await v4.p.waitForTimeout(2500);
  }
  conferir((await onde(v3.p)) === "/app/hoje", "a demo não encerra a sessão de outro visitante");

  // 3) Cliente real abre /demonstracao
  const real = await b.newContext({ userAgent: UA.replace("141", "120") });
  const pr = await novaPagina(real);
  await pr.goto(`${BASE}/entrar`);
  await pr.fill("input[type=email]", "dono@exemplo.local");
  await pr.fill("input[type=password]", SENHA_DONO);
  await pr.getByRole("button", { name: "Entrar", exact: true }).click();
  await pr.waitForURL(/\/app\//);
  const cookie = (await real.cookies()).find((k) => k.name === "eq_sessao")?.value;
  await pr.goto(`${BASE}/demonstracao`);
  const aviso = await pr.getByText(/Você está conectado como/).count();
  conferir(aviso > 0 || !/\/app\//.test(pr.url()), "cliente logado que abre /demonstracao vê o aviso em vez de entrar na demo");
  await real.addCookies([{ name: "eq_sessao", value: cookie, url: BASE }]);
  conferir((await onde(pr)) === "/app/hoje", "a sessão real continua valendo");
} finally {
  await fim(b);
}
