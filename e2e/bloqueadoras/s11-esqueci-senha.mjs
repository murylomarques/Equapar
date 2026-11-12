// S11: esqueci a senha → link por e-mail (simulado) → senha nova → sessões antigas caem → link não serve de novo.
import { createRequire } from "node:module";
import { BASE, db, navegador, novaPagina, conferir, fim } from "./util.mjs";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const email = `s11-${Date.now()}@exemplo.local`;
const antiga = "uma senha antiga bem comprida";
const nova = "outra frase nova para entrar";
const u = await db.usuario.create({ data: { nome: "Pessoa S11 (fictícia)", email, senhaHash: await bcrypt.hash(antiga, 10), emailVerificadoEm: new Date() } });

const b = await navegador();
async function entrar(senha) {
  const p = await novaPagina(await b.newContext());
  await p.goto(`${BASE}/entrar`);
  await p.fill("input[type=email]", email);
  await p.fill("input[type=password]", senha);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  // espera o resultado de verdade: entrou (saiu de /entrar) ou apareceu a mensagem de erro
  await Promise.race([p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }), p.getByText(/não conferem|Muitas tentativas/).first().waitFor({ timeout: 60000 })]).catch(() => {});
  return p;
}
try {
  const antigaSessao = await entrar(antiga);
  conferir(!/\/entrar/.test(antigaSessao.url()), "entra com a senha antiga");

  const p = await novaPagina(await b.newContext());
  await p.goto(`${BASE}/entrar`);
  await p.getByRole("link", { name: "Esqueci minha senha" }).click();
  await p.getByLabel("E-mail da conta").fill(email);
  await p.getByRole("button", { name: "Enviar o link" }).click();
  await p.getByText(/Se houver uma conta com esse e-mail/).first().waitFor();
  const aviso = await db.aviso.findFirst({ where: { destino: email, tipo: "REDEFINIR_SENHA" } });
  conferir(!!aviso, "e-mail com o link registrado (simulação)");
  const link = aviso.corpo.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, BASE);
  await p.goto(link);
  await p.getByLabel("Senha nova").fill(nova);
  await p.getByRole("button", { name: "Salvar a senha nova" }).click();
  await p.waitForURL(/\/entrar\?redefinida=1/);
  conferir(true, "senha nova salva e volta para Entrar");

  await antigaSessao.goto(`${BASE}/app/hoje`);
  conferir(/\/entrar/.test(antigaSessao.url()), "a sessão aberta antes foi encerrada");
  conferir(/\/entrar/.test((await entrar(antiga)).url()), "a senha antiga não entra mais");
  conferir(!/\/entrar/.test((await entrar(nova)).url()), "a senha nova entra");
  await p.goto(link);
  conferir((await p.getByText("Este link não vale mais").count()) > 0, "o mesmo link não serve de novo");

  // e-mail inexistente recebe a mesma resposta (não revela quem tem conta)
  await p.goto(`${BASE}/esqueci-senha`, { waitUntil: "networkidle" });
  await p.getByLabel("E-mail da conta").fill(`ninguem-${Date.now()}@exemplo.local`);
  await p.getByRole("button", { name: "Enviar o link" }).click();
  const mesma = await p.getByText(/Se houver uma conta com esse e-mail/).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  if (!mesma) console.log("      tela:", (await p.locator("main").innerText()).slice(0, 300).split(String.fromCharCode(10)).join(" | "));
  conferir(mesma, "e-mail sem conta recebe a mesma resposta");
} finally {
  await db.aviso.deleteMany({ where: { destino: email } });
  await db.usuario.delete({ where: { id: u.id } });
  await db.tentativaAcesso.deleteMany({ where: { chave: { contains: email } } });
  await fim(b);
}
