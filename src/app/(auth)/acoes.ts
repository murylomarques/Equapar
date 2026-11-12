"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  conferirSenha,
  conferirTotp,
  criarSessao,
  encerrarSessao,
  hashSenha,
  senhaFraca,
  sessaoAtual,
  ehDemo,
} from "@/lib/auth";
import { cnpjValido, soDigitos } from "@/lib/cnpj";
import { registrarEvento } from "@/lib/eventos";
import { consultarPncp } from "@/lib/pncp";

import type { Resultado } from "@/lib/acao";
import { enviarConfirmacaoEmail } from "@/lib/confirmacao-envio";
import { usarCodigoRecuperacao } from "@/lib/recuperacao";
import { chavesDeAcesso, estaBloqueado, limparChave, limparTentativas, registrarFalha } from "@/lib/limite";
import { idDoToken, lerTokenRedefinicao, tokenRedefinicao } from "@/lib/redefinir-senha";
import { consumirCotas } from "@/lib/cota";
import { ipConfiavel } from "@/lib/limite";
import { appUrl, enviar } from "@/lib/mensagens";
import { conviteValido, lerTokenConvite } from "@/lib/convite";

export type Estado = Resultado;

export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  const destino = String(fd.get("destino") ?? "");
  if (!email || !senha) return { erro: "Digite o e-mail e a senha." };
  // S1: limite no banco, por e-mail e por IP do proxy de confiança
  const chaves = chavesDeAcesso(email, await headers());
  if (await estaBloqueado(chaves)) return { erro: "Muitas tentativas seguidas. Por segurança, espere 15 minutos e tente de novo." };
  const u = await db.usuario.findUnique({ where: { email } });
  if (!(await conferirSenha(senha, u?.senhaHash)) || !u) {
    await registrarFalha(chaves);
    return { erro: "E-mail ou senha não conferem. Confira e tente de novo." };
  }
  await limparTentativas(email);
  await criarSessao(u.id, { pendente2fa: u.totpAtivo, lembrar: fd.get("lembrar") === "on" });
  if (u.totpAtivo) redirect(`/entrar/2fa${destino.startsWith("/app") ? `?destino=${encodeURIComponent(destino)}` : ""}`);
  redirect(destino.startsWith("/app") ? destino : "/app/hoje");
}

export async function confirmar2fa(_: Estado, fd: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  const codigo = String(fd.get("codigo") ?? "");
  const chave = `2fa:${s.usuarioId}`; // C8/S1: tentativas do código no banco
  if (await estaBloqueado([chave])) return { erro: "Muitas tentativas. Espere 15 minutos." };
  const okTotp = !!s.usuario.totpSegredoCifrado && conferirTotp(s.usuario.totpSegredoCifrado, codigo);
  // C8: sem o celular, um código de recuperação entra uma vez
  const resto = okTotp ? null : usarCodigoRecuperacao(codigo, s.usuario.codigosRecuperacao);
  if (!okTotp && !resto) {
    await registrarFalha([chave]);
    return { campos: { codigo: "Código não confere. Use os 6 números que o aplicativo mostra agora (o código muda a cada 30 segundos) ou um código de recuperação." } };
  }
  if (resto) await db.usuario.update({ where: { id: s.usuarioId }, data: { codigosRecuperacao: resto } });
  await limparChave(chave);
  await db.sessao.update({ where: { id: s.id }, data: { pendente2fa: false } });
  const destino = String(fd.get("destino") ?? "");
  redirect(destino.startsWith("/app") ? destino : "/app/hoje");
}

const esquemaConta = z.object({
  nome: z.string().trim().min(2, "Digite seu nome."),
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido, como nome@empresa.com.br."),
  senha: z.string(),
  tipo: z.enum(["EMPRESA", "ASSESSORIA"]),
  cnpj: z.string().transform(soDigitos),
  razaoSocial: z.string().trim(),
  termos: z.literal("on", { message: "Para criar a conta, aceite os termos de uso e a política de privacidade." }),
});

export async function criarConta(_: Estado, fd: FormData): Promise<Estado> {
  const bruto = Object.fromEntries(["nome", "email", "senha", "tipo", "cnpj", "razaoSocial", "termos"].map((k) => [k, String(fd.get(k) ?? "")]));
  const p = esquemaConta.safeParse(bruto);
  const erros: Record<string, string> = {};
  if (!p.success) for (const i of p.error.issues) erros[String(i.path[0])] ??= i.message;
  const fraca = senhaFraca(bruto.senha, { email: bruto.email });
  if (fraca) erros.senha = fraca;
  const cnpj = soDigitos(bruto.cnpj);
  if (bruto.tipo !== "ASSESSORIA" || cnpj) {
    if (!cnpjValido(cnpj)) erros.cnpj = "Esse CNPJ não existe. Confira os 14 números.";
  }
  if (Object.keys(erros).length || !p.success) return { campos: erros };
  const d = p.data;
  if (await db.usuario.findUnique({ where: { email: d.email } })) return { campos: { email: "Já existe uma conta com este e-mail. Use a tela Entrar." } };

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
  await enviarConfirmacaoEmail(usuario); // C7: sem confirmar, usa o produto mas não recebe avisos
  await criarSessao(usuario.id, { contaId: usuario.membros[0].contaId });
  redirect(d.tipo === "ASSESSORIA" && !cnpj ? "/app/clientes" : "/app/boas-vindas");
}

/** Usuário que entrou com Google e ainda não tem conta/empresa. */
export async function completarEmpresa(_: Estado, fd: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  // S6: só com a sessão completa (duas etapas confirmadas)
  if (s.pendente2fa) redirect("/entrar/2fa");
  // S6: quem já participa de uma conta só cria outra pelo fluxo explícito ("Criar outra conta")
  if (fd.get("novaConta") !== "1" && (await db.membro.count({ where: { usuarioId: s.usuarioId } })) > 0) redirect("/app/hoje");
  const tipo: "ASSESSORIA" | "EMPRESA" = fd.get("tipo") === "ASSESSORIA" ? "ASSESSORIA" : "EMPRESA";
  const cnpj = soDigitos(String(fd.get("cnpj") ?? ""));
  const razao = String(fd.get("razaoSocial") ?? "").trim();
  if (!(tipo === "ASSESSORIA" && !cnpj) && !cnpjValido(cnpj)) return { campos: { cnpj: "Esse CNPJ não existe. Confira os 14 números." } };
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

// ---------------------------------------------------------------------------
// S11. Esqueci minha senha
// ---------------------------------------------------------------------------

/** Pede o link. A resposta é sempre a mesma: não revela se o e-mail tem conta. */
export async function pedirRedefinicao(_: Estado, fd: FormData): Promise<Estado> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { campos: { email: "Digite o e-mail da sua conta, como nome@empresa.com.br." } };
  const resposta = { ok: "Se houver uma conta com esse e-mail, enviamos um link para criar uma senha nova. Ele vale por 1 hora." };
  const ip = ipConfiavel(await headers());
  if (!(await consumirCotas([{ chave: `redefinir:email:${email}`, limite: 3 }, ...(ip ? [{ chave: `redefinir:ip:${ip}`, limite: 10 }] : [])]))) return resposta;
  const u = await db.usuario.findUnique({ where: { email } });
  if (u && !ehDemo({ usuario: u })) {
    const link = appUrl(`/redefinir-senha?t=${encodeURIComponent(tokenRedefinicao(u))}`);
    await enviar({
      contaId: null,
      chave: `redefinir:${u.id}:${Date.now()}`,
      tipo: "REDEFINIR_SENHA",
      canal: "EMAIL",
      destino: u.email,
      assunto: "Criar uma senha nova na Equapar",
      corpo: `Recebemos um pedido para criar uma senha nova na sua conta. Use este link, que vale por 1 hora e serve uma vez só: ${link}\n\nSe não foi você, ignore esta mensagem; sua senha continua a mesma.`,
    });
  }
  return resposta;
}

/** Grava a senha nova, confirma o e-mail (o link chegou nele) e encerra todas as sessões. */
export async function redefinirSenha(_: Estado, fd: FormData): Promise<Estado> {
  const token = String(fd.get("t") ?? "");
  const nova = String(fd.get("senha") ?? "");
  const id = idDoToken(token);
  const u = id ? await db.usuario.findUnique({ where: { id } }) : null;
  const leitura = u ? lerTokenRedefinicao(token, u) : ({ erro: "invalido" } as const);
  if (!u || "erro" in leitura) return { erro: "Este link não vale mais (vence em 1 hora e serve uma vez só). Peça outro em Esqueci minha senha." };
  const fraca = senhaFraca(nova, { duasEtapas: u.totpAtivo, email: u.email });
  if (fraca) return { campos: { senha: fraca } };
  await db.usuario.update({ where: { id: u.id }, data: { senhaHash: await hashSenha(nova), emailVerificadoEm: u.emailVerificadoEm ?? new Date() } });
  await db.sessao.deleteMany({ where: { usuarioId: u.id } });
  await limparTentativas(u.email);
  redirect("/entrar?redefinida=1");
}

// ---------------------------------------------------------------------------
// S12. Aceitar convite: a pessoa convidada define a própria senha
// ---------------------------------------------------------------------------

export async function aceitarConvite(_: Estado, fd: FormData): Promise<Estado> {
  const t = lerTokenConvite(String(fd.get("t") ?? ""));
  const u = t ? await db.usuario.findUnique({ where: { id: t.usuarioId } }) : null;
  if (!t || !u || conviteValido(t, u) !== "ok") return { erro: "Este convite não vale mais (vence em 7 dias e serve uma vez só). Peça um novo a quem convidou." };
  const membro = await db.membro.findUnique({ where: { usuarioId_contaId: { usuarioId: u.id, contaId: t.contaId } } });
  if (!membro) return { erro: "Você não faz mais parte desta conta. Fale com quem convidou." };
  const senha = String(fd.get("senha") ?? "");
  const fraca = senhaFraca(senha, { email: u.email });
  if (fraca) return { campos: { senha: fraca } };
  await db.usuario.update({ where: { id: u.id }, data: { senhaHash: await hashSenha(senha), emailVerificadoEm: u.emailVerificadoEm ?? new Date() } });
  await criarSessao(u.id, { contaId: t.contaId });
  redirect("/app/hoje");
}
