// S1: 5 senhas erradas para o mesmo e-mail bloqueiam o acesso, mesmo trocando o X-Forwarded-For a cada tentativa.
import { BASE, db, navegador, novaPagina, conferir, fim } from "./util.mjs";

const email = `ninguem-s1-${Date.now()}@exemplo.local`;
const b = await navegador();
try {
  for (let i = 0; i < 6; i++) {
    const ctx = await b.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.0.0.${i}` } });
    const p = await novaPagina(ctx);
    await p.goto(`${BASE}/entrar`);
    await p.fill("input[type=email]", email);
    await p.fill("input[type=password]", "senha errada qualquer");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    const msg = p.getByText(/não conferem|Muitas tentativas/).first();
    await msg.waitFor();
    const texto = await msg.innerText();
    if (i === 5) conferir(/Muitas tentativas/.test(texto), `6ª tentativa, com outro X-Forwarded-For, é bloqueada ("${texto.slice(0, 40)}…")`);
    await ctx.close();
  }
  const t = await db.tentativaAcesso.findUnique({ where: { chave: `email:${email}` } });
  conferir(!!t?.bloqueadoAte, "o bloqueio está gravado no banco (vale para todos os processos)");
} finally {
  await db.tentativaAcesso.deleteMany({ where: { chave: `email:${email}` } });
  await fim(b);
}
