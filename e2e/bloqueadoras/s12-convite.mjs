// S12: convidar sem mostrar senha; a pessoa convidada cria a própria senha pelo link (7 dias) e entra na conta.
import { BASE, db, navegador, entrarComoDono, novaPagina, conferir, fim } from "./util.mjs";

const email = `s12-${Date.now()}@exemplo.local`;
const b = await navegador();
try {
  const dono = await entrarComoDono(await b.newContext());
  await dono.goto(`${BASE}/app/configuracoes?aba=pessoas`);
  const form = dono.locator("form", { has: dono.getByLabel("E-mail") });
  await form.getByLabel("Nome").fill("Pessoa Convidada (fictícia)");
  await form.getByLabel("E-mail").fill(email);
  await form.getByRole("button").last().click();
  const msg = await dono.getByText(/Convite enviado/).first().innerText();
  conferir(!/senha/i.test(msg), `quem convida não vê senha ("${msg}")`);
  const aviso = await db.aviso.findFirst({ where: { destino: email, tipo: "CONVITE" } });
  const link = aviso.corpo.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, BASE);
  const p = await novaPagina(await b.newContext());
  await p.goto(link);
  await p.getByLabel("Crie sua senha").fill("minha frase de entrada segura");
  await p.getByRole("button", { name: "Entrar na Equapar" }).click();
  await p.waitForURL(/\/app\/hoje/);
  conferir(true, "a pessoa convidada cria a senha e entra na conta");
  await p.goto(link);
  conferir((await p.getByText("Convite já aceito").count()) > 0, "o link não serve de novo");
} finally {
  const u = await db.usuario.findUnique({ where: { email } });
  if (u) await db.usuario.delete({ where: { id: u.id } });
  await db.aviso.deleteMany({ where: { destino: email } });
  await fim(b);
}
