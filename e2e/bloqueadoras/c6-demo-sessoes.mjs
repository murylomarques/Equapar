// C6: a demonstração não pode derrubar visitantes nem a sessão de um cliente real.
// Esperado: todos continuam logados; a demo não encerra a sessão de outro visitante.
import { BASE, SENHA_DONO, navegador, novaPagina, conferir, fim } from "./util.mjs";

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
