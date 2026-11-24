// Jornada 19: pessoa com papel Leitura na conta de exemplo vê tudo, mas não edita, não aprova e não mexe na
// cobrança. O servidor confere de novo em cada ação (src/lib/seguranca-acoes.test.ts). Só dados fictícios.
import { createRequire } from "node:module";
import { BASE, db, navegador, conferir, fim, novaPagina } from "./bloqueadoras/util.mjs";

const bcrypt = createRequire(import.meta.url)("bcryptjs");
const email = `leitura-${Date.now()}@exemplo.local`;
const senha = "SenhaLeitura-12345";
const dono = await db.usuario.findUnique({ where: { email: "dono@exemplo.local" }, include: { membros: true } });
const contaId = dono.membros[0].contaId;
const u = await db.usuario.create({ data: { nome: "Leitora (exemplo)", email, senhaHash: await bcrypt.hash(senha, 10), emailVerificadoEm: new Date(), membros: { create: { contaId, papel: "LEITURA" } } } });
const pedido = await db.pedido.findFirst({ where: { contrato: { empresa: { contaId } }, estado: "PROTOCOLADO" } });

const b = await navegador();
try {
  const p = await novaPagina(await b.newContext());
  await p.goto(`${BASE}/entrar`);
  await p.fill("input[type=email]", email);
  await p.fill("input[type=password]", senha);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(/\/app\//, { timeout: 120000 });
  conferir(true, "papel Leitura entra na conta");

  await p.goto(`${BASE}/app/carteira`);
  conferir((await p.getByRole("link", { name: "Cadastrar contrato" }).count()) === 0, "Leitura não vê 'Cadastrar contrato'");
  await p.goto(`${BASE}/app/configuracoes?aba=cobranca`);
  await p.locator("main h1").first().waitFor();
  conferir((await p.getByRole("button", { name: "Ver o que muda" }).count()) === 0, "Leitura não muda o plano");
  conferir((await p.getByRole("link", { name: "Cancelar a renovação" }).count()) === 0, "Leitura não cancela a assinatura");
  if (pedido) {
    await p.goto(`${BASE}/app/pedidos/${pedido.id}/pronto`);
    await p.locator("main h1").first().waitFor();
    conferir((await p.getByRole("button", { name: "Registrar resposta" }).count()) === 0, "Leitura não registra a resposta do órgão");
  }
  // a área do painel interno não existe para quem não está em PAINEL_EMAILS
  const r = await p.request.get(`${BASE}/app/interno`);
  conferir(!(await r.text()).includes("Pesquisa de encaixe"), "Leitura não vê o painel interno");
} finally {
  await db.sessao.deleteMany({ where: { usuarioId: u.id } });
  await db.membro.deleteMany({ where: { usuarioId: u.id } });
  await db.usuario.delete({ where: { id: u.id } });
  await fim(b);
}
