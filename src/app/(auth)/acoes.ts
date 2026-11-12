"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bloqueado,
  conferirSenha,
  conferirTotp,
  criarSessao,
  encerrarSessao,
  falhou,
  hashSenha,
  limparFalhas,
  senhaFraca,
  sessaoAtual,
} from "@/lib/auth";
import { cnpjValido, soDigitos } from "@/lib/cnpj";
import { registrarEvento } from "@/lib/eventos";
import { consultarPncp } from "@/lib/pncp";

export interface Estado {
  erro?: string;
  erros?: Record<string, string>;
  valores?: Record<string, string>;
}

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  const destino = String(fd.get("destino") ?? "");
  const chave = `${email}|${await ip()}`;
  if (bloqueado(chave)) return { erro: "Muitas tentativas. Espere 15 minutos e tente de novo.", valores: { email } };
  const u = await db.usuario.findUnique({ where: { email } });
  if (!u || !(await conferirSenha(senha, u.senhaHash))) {
    falhou(chave);
    return { erro: "E-mail ou senha não conferem.", valores: { email } };
  }
  limparFalhas(chave);
  await criarSessao(u.id, { pendente2fa: u.totpAtivo });
  if (u.totpAtivo) redirect(`/entrar/2fa${destino.startsWith("/app") ? `?destino=${encodeURIComponent(destino)}` : ""}`);
  redirect(destino.startsWith("/app") ? destino : "/app/hoje");
}

export async function confirmar2fa(_: Estado, fd: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  const codigo = String(fd.get("codigo") ?? "");
  const chave = `2fa|${s.usuarioId}`;
  if (bloqueado(chave)) return { erro: "Muitas tentativas. Espere 15 minutos." };
  if (!s.usuario.totpSegredoCifrado || !conferirTotp(s.usuario.totpSegredoCifrado, codigo)) {
    falhou(chave);
    return { erro: "Código não confere. Use o código de 6 números do aplicativo, que muda a cada 30 segundos." };
  }
  limparFalhas(chave);
  await db.sessao.update({ where: { id: s.id }, data: { pendente2fa: false } });
  const destino = String(fd.get("destino") ?? "");
  redirect(destino.startsWith("/app") ? destino : "/app/hoje");
}

const esquemaConta = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("Confira o e-mail: falta o @ ou o domínio."),
  senha: z.string(),
  tipo: z.enum(["EMPRESA", "ASSESSORIA"]),
  cnpj: z.string().transform(soDigitos),
  razaoSocial: z.string().trim(),
  termos: z.literal("on", { message: "Para criar a conta, aceite os termos de uso e a política de privacidade." }),
});

export async function criarConta(_: Estado, fd: FormData): Promise<Estado> {
  const bruto = Object.fromEntries(["nome", "email", "senha", "tipo", "cnpj", "razaoSocial", "termos"].map((k) => [k, String(fd.get(k) ?? "")]));
  const valores = { ...bruto, senha: "" };
  const p = esquemaConta.safeParse(bruto);
  const erros: Record<string, string> = {};
  if (!p.success) for (const i of p.error.issues) erros[String(i.path[0])] ??= i.message;
  const fraca = senhaFraca(bruto.senha);
  if (fraca) erros.senha = fraca;
  const cnpj = soDigitos(bruto.cnpj);
  if (bruto.tipo !== "ASSESSORIA" || cnpj) {
    if (!cnpjValido(cnpj)) erros.cnpj = "Esse CNPJ não existe. Confira os 14 números.";
  }
  if (Object.keys(erros).length || !p.success) return { erros, valores };
  const d = p.data;
  if (await db.usuario.findUnique({ where: { email: d.email } })) return { erros: { email: "Já existe uma conta com este e-mail. Entre ou recupere o acesso." }, valores };

  let razao = d.razaoSocial;
  if (cnpj && !razao) {
    try {
      razao = (await consultarPncp(cnpj, { timeoutMs: 8000 })).razaoSocial ?? "";
    } catch {
      /* segue sem a razão social do PNCP */
    }
  }

  const usuario = await db.usuario.create({
    data: {
      nome: d.nome,
      email: d.email,
      senhaHash: await hashSenha(d.senha),
      membros: {
        create: {
          papel: "DONO",
          conta: {
            create: {
              nome: d.tipo === "ASSESSORIA" ? razao || d.nome : razao || "Minha empresa",
              tipo: d.tipo,
              marcaNome: d.tipo === "ASSESSORIA" ? razao || null : null,
              empresas: cnpj ? { create: { cnpj, razaoSocial: razao || `CNPJ ${cnpj}` } } : undefined,
            },
          },
        },
      },
    },
    include: { membros: true },
  });
  await registrarEvento("conta_criada", { tipo: d.tipo });
  await criarSessao(usuario.id, { contaId: usuario.membros[0].contaId });
  redirect(d.tipo === "ASSESSORIA" && !cnpj ? "/app/clientes" : "/app/boas-vindas");
}

/** Usuário que entrou com Google e ainda não tem conta/empresa. */
export async function completarEmpresa(_: Estado, fd: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  const tipo: "ASSESSORIA" | "EMPRESA" = fd.get("tipo") === "ASSESSORIA" ? "ASSESSORIA" : "EMPRESA";
  const cnpj = soDigitos(String(fd.get("cnpj") ?? ""));
  const razao = String(fd.get("razaoSocial") ?? "").trim();
  if (!(tipo === "ASSESSORIA" && !cnpj) && !cnpjValido(cnpj)) return { erros: { cnpj: "Esse CNPJ não existe. Confira os 14 números." } };
  const m = await db.membro.create({
    data: {
      usuario: { connect: { id: s.usuarioId } },
      papel: "DONO",
      conta: {
        create: {
          nome: razao || (tipo === "ASSESSORIA" ? s.usuario.nome : "Minha empresa"),
          tipo,
          empresas: cnpj ? { create: { cnpj, razaoSocial: razao || `CNPJ ${cnpj}` } } : undefined,
        },
      },
    },
  });
  await db.sessao.update({ where: { id: s.id }, data: { contaId: m.contaId } });
  await registrarEvento("conta_criada", { tipo });
  redirect(tipo === "ASSESSORIA" && !cnpj ? "/app/clientes" : "/app/boas-vindas");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
