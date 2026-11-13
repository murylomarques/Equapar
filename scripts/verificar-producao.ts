/**
 * G2. Confere o ambiente antes de subir. Imprime OK, AVISO ou FALHA, linha a linha. NUNCA imprime o valor
 * de um segredo. Termina com código diferente de 0 se faltar alguma obrigatória ou algo essencial falhar.
 *
 *   npm run verificar:producao                 (lê o .env)
 *   npm run verificar:producao:imagem          (dentro da imagem Docker, lê o ambiente do contêiner)
 *   ... -- --enviar-teste                      (envia um e-mail de teste para os endereços de PAINEL_EMAILS)
 *
 * Armazenamento S3: grava, lê e apaga um objeto de teste em _verificacao/ (só o objeto que ele mesmo criou).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { armazenamento } from "../src/lib/armazenamento";
import { cnpjValido } from "../src/lib/mascaras";
import { contatoSite, dadosEmpresa, VARIAVEIS_SITE } from "../src/lib/site";
import { jornadaLiberada, modoPiloto } from "../src/lib/chaves";

type Nivel = "OK" | "AVISO" | "FALHA";
const linhas: { nivel: Nivel; grupo: string; texto: string }[] = [];
const marcar = (nivel: Nivel, grupo: string, texto: string) => linhas.push({ nivel, grupo, texto });
const env = (k: string) => process.env[k]?.trim() ?? "";
const tem = (k: string) => !!env(k);
const producao = process.env.NODE_ENV === "production" || env("APP_URL").startsWith("https://") || process.argv.includes("--producao");
const enviarTeste = process.argv.includes("--enviar-teste");

async function base() {
  for (const k of ["DATABASE_URL", "APP_SECRET", "APP_URL"]) marcar(tem(k) ? "OK" : "FALHA", "Base", `${k} ${tem(k) ? "preenchida" : "FALTANDO (obrigatória)"}`);
  if (tem("APP_URL")) marcar(env("APP_URL").startsWith("https://") ? "OK" : producao ? "FALHA" : "AVISO", "Base", env("APP_URL").startsWith("https://") ? "APP_URL começa com https://" : "APP_URL não começa com https:// (obrigatório em produção)");
  if (tem("APP_SECRET")) marcar(env("APP_SECRET").length >= 32 ? "OK" : "FALHA", "Base", `APP_SECRET com ${env("APP_SECRET").length >= 32 ? "32 caracteres ou mais" : "MENOS de 32 caracteres"}`);
}

async function banco() {
  if (!tem("DATABASE_URL")) return marcar("FALHA", "Banco", "sem DATABASE_URL, não há como conectar");
  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    marcar("OK", "Banco", "conectou");
    const pasta = path.join(process.cwd(), "prisma", "migrations");
    const esperadas = fs.readdirSync(pasta).filter((n) => fs.statSync(path.join(pasta, n)).isDirectory());
    const aplicadas = (await db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`).map((m) => m.migration_name);
    const faltam = esperadas.filter((m) => !aplicadas.includes(m));
    marcar(faltam.length ? "FALHA" : "OK", "Banco", faltam.length ? `migrações não aplicadas: ${faltam.join(", ")} (rode: npx prisma migrate deploy)` : `todas as ${esperadas.length} migrações aplicadas`);
  } catch (e) {
    marcar("FALHA", "Banco", `não conectou (${(e as Error).message.split("\n")[0].slice(0, 120)})`);
  } finally {
    await db.$disconnect();
  }
}

async function arquivos() {
  if (env("ARMAZENAMENTO") !== "s3") return marcar(producao ? "AVISO" : "OK", "Armazenamento", producao ? "sem ARMAZENAMENTO=s3: arquivos no disco do servidor (perdidos se o contêiner for recriado)" : "disco local (desenvolvimento)");
  for (const k of ["S3_BUCKET", "S3_REGION"]) if (!tem(k)) marcar("FALHA", "Armazenamento", `${k} FALTANDO com ARMAZENAMENTO=s3`);
  const chave = `_verificacao/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.txt`;
  const conteudo = Buffer.from("verificacao equapar");
  try {
    const a = await armazenamento();
    await a.gravar(chave, conteudo, "text/plain");
    const lido = await a.ler(chave);
    await a.apagar(chave); // só o objeto que este script criou
    marcar(lido.equals(conteudo) ? "OK" : "FALHA", "Armazenamento", lido.equals(conteudo) ? "S3: gravou, leu e apagou o objeto de teste em _verificacao/" : "S3: o objeto lido não confere");
  } catch (e) {
    marcar("FALHA", "Armazenamento", `S3 falhou (${(e as Error).name}: ${(e as Error).message.slice(0, 120)})`);
  }
}

async function email() {
  if (!tem("SMTP_URL")) return marcar(producao ? "AVISO" : "OK", "E-mail", producao ? "sem SMTP_URL: ninguém confirma conta nem recebe aviso" : "sem SMTP_URL: simulação (desenvolvimento)");
  if (!tem("EMAIL_FROM")) marcar("AVISO", "E-mail", "sem EMAIL_FROM: usa o remetente padrão do domínio do contato");
  const nodemailer = await import("nodemailer");
  const t = nodemailer.createTransport(env("SMTP_URL"));
  try {
    await t.verify(); // conecta e autentica, sem enviar
    marcar("OK", "E-mail", "SMTP: conectou e autenticou");
    if (enviarTeste) {
      const para = env("PAINEL_EMAILS").split(",").map((s) => s.trim()).filter(Boolean);
      if (!para.length) marcar("AVISO", "E-mail", "--enviar-teste sem PAINEL_EMAILS: nada enviado");
      else {
        await t.sendMail({ from: env("EMAIL_FROM") || undefined, to: para, subject: "Equapar: e-mail de teste", text: "E-mail de teste do npm run verificar:producao." });
        marcar("OK", "E-mail", `e-mail de teste enviado para ${para.length} endereço(s) de PAINEL_EMAILS`);
      }
    }
  } catch (e) {
    marcar("FALHA", "E-mail", `SMTP não autenticou (${(e as Error).message.slice(0, 120)})`);
  }
}

function pares() {
  const par = (grupo: string, a: string, b: string) => {
    if (tem(a) !== tem(b)) marcar("FALHA", grupo, `${a} e ${b} precisam estar juntas (só uma está preenchida)`);
    else marcar(tem(a) ? "OK" : producao && grupo === "Turnstile" ? "AVISO" : "OK", grupo, tem(a) ? "as duas chaves preenchidas" : grupo === "Turnstile" ? "sem chaves: captcha em simulação" : "sem chaves: recurso desligado");
  };
  par("Turnstile", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  par("Google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  if (!tem("ASAAS_API_KEY")) marcar("OK", "Asaas", "sem chave: cobrança em simulação");
  else {
    const prod = env("ASAAS_AMBIENTE") === "producao";
    const chaveProd = env("ASAAS_API_KEY").startsWith("$aact_prod_");
    const chaveSand = env("ASAAS_API_KEY").startsWith("$aact_hmlg_");
    marcar(prod === chaveProd && (chaveProd || chaveSand) ? "OK" : "FALHA", "Asaas", prod === chaveProd ? `ambiente ${prod ? "produção" : "sandbox"} coerente com o prefixo da chave` : "ASAAS_AMBIENTE não combina com o prefixo da ASAAS_API_KEY");
    const tok = env("ASAAS_WEBHOOK_TOKEN").length;
    marcar(tok >= 32 && tok <= 255 ? "OK" : "FALHA", "Asaas", tok ? (tok >= 32 && tok <= 255 ? "token do webhook presente" : "token do webhook fora de 32 a 255 caracteres") : "ASAAS_WEBHOOK_TOKEN FALTANDO com o Asaas ligado");
  }
}

function redeEDados() {
  marcar(tem("TRUSTED_PROXY_HEADER") ? "OK" : producao ? "AVISO" : "OK", "Rede", tem("TRUSTED_PROXY_HEADER") ? `TRUSTED_PROXY_HEADER = ${env("TRUSTED_PROXY_HEADER")}` : "sem TRUSTED_PROXY_HEADER: os limites por IP ficam desligados");
  const e = dadosEmpresa();
  const c = contatoSite();
  const aparece = [
    `e-mail ${c.email}`,
    c.whatsapp ? "WhatsApp" : "sem WhatsApp (contato por e-mail)",
    e.fundadorNome ? "nome do fundador" : "sem nome do fundador (bloco mostra só a empresa)",
    e.cnpj ? "razão social e CNPJ" : `"${e.razaoSocial}"`,
    e.local ? (e.endereco ? "endereço" : "só a cidade") : "sem endereço nem cidade",
  ];
  marcar("OK", "Site", `vai aparecer: ${aparece.join("; ")}`);
  const faltam = VARIAVEIS_SITE.filter((k) => !tem(k));
  if (faltam.length) marcar("AVISO", "Site", `vazias: ${faltam.join(", ")}`);
  if (tem("SITE_CNPJ") && !cnpjValido(env("SITE_CNPJ"))) marcar("AVISO", "Site", "SITE_CNPJ inválido: não aparece no site");
}

function chaves() {
  const estado = (b: boolean) => (b ? "ligada" : "desligada");
  marcar("OK", "Chaves", `MODO_PILOTO ${estado(modoPiloto())}`);
  marcar("OK", "Chaves", `JORNADA_REGRA_CONFIRMADA ${estado(jornadaLiberada())}${jornadaLiberada() ? "" : " (só PAINEL_EMAILS veem, com a marca de simulação)"}`);
  for (const k of ["IA_LEITURA_PLANILHA", "IA_LEITURA_CONVENCAO"])
    marcar("OK", "Chaves", `${k} ${estado(env(k) === "true")}${tem("ANTHROPIC_API_KEY") ? "" : " (sem ANTHROPIC_API_KEY: nada de IA aparece)"}`);
  for (const k of ["LIMPEZA_DEMOS_AUTOMATICA", "LIMPEZA_CONTAS_CANCELADAS"]) marcar(env(k) === "true" ? "AVISO" : "OK", "Chaves", `${k} ${estado(env(k) === "true")}${env(k) === "true" ? " (APAGA dados: leia a simulação antes)" : ""}`);
  marcar("OK", "Chaves", `DEMO_MAX_ATIVAS ${env("DEMO_MAX_ATIVAS") || "300 (padrão)"}`);
}

async function main() {
  console.log(`Equapar: verificação do ambiente (${producao ? "produção" : "desenvolvimento"}). Valores de segredos nunca são mostrados.\n`);
  await base();
  await banco();
  await arquivos();
  await email();
  pares();
  redeEDados();
  chaves();
  for (const l of linhas) console.log(`${l.nivel.padEnd(5)} ${l.grupo.padEnd(14)} ${l.texto}`);
  const falhas = linhas.filter((l) => l.nivel === "FALHA").length;
  const avisos = linhas.filter((l) => l.nivel === "AVISO").length;
  console.log(`\n${falhas} falha(s), ${avisos} aviso(s).`);
  process.exitCode = falhas ? 1 : 0;
}

main();
