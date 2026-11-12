// Utilidades dos testes das falhas bloqueadoras (C1–C8). Só dados fictícios.
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const SENHA_DONO = process.env.SENHA_DONO;
if (!SENHA_DONO) throw new Error("Defina SENHA_DONO com a senha do dono@exemplo.local impressa pelo seed.");
export const db = new PrismaClient();
export const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "equapar-e2e-"));

export async function navegador() {
  const canal = process.env.NAVEGADOR; // vazio = Chromium do Playwright
  return chromium.launch(canal ? { channel: canal } : {});
}

// O servidor de desenvolvimento compila cada página na primeira visita: tempos folgados.
export async function novaPagina(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.setDefaultNavigationTimeout(180000);
  return p;
}

export async function entrarComoDono(ctx) {
  const p = await novaPagina(ctx);
  await p.goto(`${BASE}/entrar`);
  await p.fill("input[type=email]", "dono@exemplo.local");
  await p.fill("input[type=password]", SENHA_DONO);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(/\/app\//, { timeout: 180000 });
  return p;
}

/** Confirma a janela de confirmação, se ela abrir. */
export async function confirmarSeAbrir(p, timeout = 2500) {
  const j = p.getByRole("dialog");
  try {
    await j.waitFor({ state: "visible", timeout });
    await j.getByRole("button").last().click();
    return true;
  } catch {
    return false;
  }
}

const falhas = [];
export function conferir(cond, msg) {
  console.log(`${cond ? "OK   " : "FALHA"} ${msg}`);
  if (!cond) falhas.push(msg);
}
export async function fim(browser) {
  await browser?.close().catch(() => {});
  await db.$disconnect();
  if (falhas.length) {
    console.log(`\n${falhas.length} verificação(ões) falharam.`);
    process.exitCode = 1;
  } else console.log("\nTudo certo.");
}
