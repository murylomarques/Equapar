// C7: cadastro com confirmação de e-mail. Sem confirmar, usa o produto mas não recebe avisos;
// o link (e-mail simulado, registrado em Avisos) confirma e o aviso do topo some.
import { BASE, db, navegador, novaPagina, conferir, fim } from "./util.mjs";

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

const email = `c7-${Date.now()}@exemplo.local`;
const b = await navegador();
try {
  const p = await novaPagina(await b.newContext());
  await p.goto(`${BASE}/criar-conta?cnpj=${cnpj()}`);
  await p.getByLabel("Seu nome").fill("Pessoa Teste C7");
  await p.getByLabel("E-mail de trabalho").fill(email);
  await p.getByLabel("Senha", { exact: true }).fill("uma senha longa de teste 2026");
  await p.getByLabel(/^Razão social/).fill("Empresa Teste C7 (fictícia)");
  await p.locator('input[name="termos"]').check();
  await p.getByRole("button", { name: "Criar conta" }).click();
  await p.waitForURL(/\/app\//);
  conferir((await p.getByText(/Confirme seu e-mail/).count()) > 0, "depois do cadastro, o topo pede para confirmar o e-mail");
  const u = await db.usuario.findUnique({ where: { email } });
  conferir(u && !u.emailVerificadoEm, "e-mail ainda não confirmado no banco");
  const aviso = await db.aviso.findFirst({ where: { destino: email, tipo: "CONFIRMAR_EMAIL" }, orderBy: { enviadoEm: "desc" } });
  conferir(!!aviso, "e-mail de confirmação registrado (simulação)");
  const link = aviso?.corpo.match(/https?:\/\/\S+/)?.[0];
  // o corpo guarda o link original; os links rastreados (/r/…) redirecionam para ele
  await p.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await p.getByText("E-mail confirmado").first().waitFor();
  const u2 = await db.usuario.findUnique({ where: { email } });
  conferir(!!u2.emailVerificadoEm, "o link confirma o e-mail");
  await p.goto(`${BASE}/app/hoje`);
  conferir((await p.getByText(/Confirme seu e-mail/).count()) === 0, "o aviso do topo some depois de confirmar");
  await p.goto(`${BASE}/confirmar-email?t=adulterado.123`);
  conferir((await p.getByText("Este link não vale mais").count()) > 0, "link alterado é recusado");
} finally {
  const u = await db.usuario.findUnique({ where: { email }, include: { membros: true } });
  if (u) {
    for (const m of u.membros) await db.conta.deleteMany({ where: { id: m.contaId } });
    await db.usuario.delete({ where: { id: u.id } });
  }
  await db.aviso.deleteMany({ where: { destino: email } });
  await fim(b);
}
