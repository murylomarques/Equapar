// S2: o formulário do relatório do Raio-X não pode virar disparador de e-mail: no máximo 3 por destino por dia.
import { BASE, db, navegador, novaPagina, conferir, fim } from "./util.mjs";

// CNPJs fictícios com dígitos válidos, um por envio, com resultado em cache
function cnpjValido(base) {
  const b = base.split("").map(Number);
  const dv = (n) => {
    const p = n.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = n.reduce((s, x, i) => s + x * p[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(b);
  return [...b, d1, dv([...b, d1])].join("");
}
const CNPJS = [0, 1, 2, 3].map((i) => cnpjValido(`9876543${i}0001`));
const destino = `vitima-s2-${Date.now()}@exemplo.local`;
const hoje = new Date().toISOString().slice(0, 10);
const resultado = (CNPJ) => ({ cnpj: CNPJ, razaoSocial: "EMPRESA EXEMPLO (FICTÍCIA)", consultadoEm: new Date().toISOString(), fonte: "cache", contratos: [{ controle: "X-1", numero: "1/2025", orgao: "Órgão Exemplo", orgaoCnpj: "", uf: "ES", municipio: "Cidade Exemplo", esfera: "M", objeto: "Limpeza (exemplo)", inicio: `${hoje}`, fim: "2027-12-31", valorGlobal: null, link: "https://pncp.gov.br", sugereMaoDeObra: true }] });
for (const c of CNPJS) await db.raioXCache.upsert({ where: { cnpj: c }, create: { cnpj: c, resultado: resultado(c) }, update: { resultado: resultado(c), consultadoEm: new Date() } });

const b = await navegador();
try {
  const aceitos = [];
  for (let i = 0; i < 4; i++) {
    const p = await novaPagina(await b.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.1.0.${i}` } }));
    await p.goto(`${BASE}/raio-x?cnpj=${CNPJS[i]}`);
    const form = p.locator("form", { has: p.getByRole("button", { name: "Enviar relatório" }) });
    await form.getByLabel("E-mail", { exact: true }).fill(destino);
    await form.getByRole("button", { name: "Enviar relatório" }).click();
    await p.waitForTimeout(4000);
    aceitos.push(await db.aviso.count({ where: { destino } }));
    await p.context().close();
  }
  console.log("      e-mails registrados após cada envio:", aceitos.join(", "));
  conferir(aceitos.at(-1) <= 3, `no máximo 3 relatórios para o mesmo e-mail no dia (foram ${aceitos.at(-1)})`);
} finally {
  await db.aviso.deleteMany({ where: { destino } });
  await db.lead.deleteMany({ where: { email: destino } });
  await db.tentativaAcesso.deleteMany({ where: { chave: { contains: destino } } });
  await db.raioXCache.deleteMany({ where: { cnpj: { in: CNPJS } } });
  await fim(b);
}
