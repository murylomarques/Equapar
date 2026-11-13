"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarSessao, ehDemo, sessaoAtual } from "@/lib/auth";
import { criarContaDemo, LimiteDemonstracoes } from "@/lib/demo";
import { ipConfiavel, usarCota } from "@/lib/limite";
import { verificarCaptcha } from "@/lib/captcha";
import { registrarEvento } from "@/lib/eventos";

/** A3: no máximo 3 demonstrações por IP a cada hora. */
const DEMOS_POR_IP = 3;
const UMA_HORA = 3_600_000;

/**
 * Entra na demonstração (POST). Um GET em /demonstracao nunca abre sessão (C6), e quem já está
 * conectado numa conta real não é trocado de conta: a página mostra o aviso.
 */
export async function entrarNaDemonstracao(fd?: FormData) {
  const s = await sessaoAtual();
  if (s && !s.pendente2fa && !ehDemo(s)) redirect("/demonstracao");
  if (s && ehDemo(s)) redirect("/app/hoje");
  // C6.2: cada visitante ganha a própria cópia dos dados fictícios (4 horas) e pode montar um pedido
  // 5.2: a página "Para assessorias" abre a demonstração com vários clientes fictícios
  const tipo = fd?.get("tipo") === "assessoria" ? "ASSESSORIA" : "EMPRESA";
  const voltar = "/demonstracao"; // a página de assessorias é estática: o aviso aparece aqui
  // A3: captcha (quando TURNSTILE_SECRET_KEY existe), cota por IP e limite global de demonstrações ativas
  const ip = ipConfiavel(await headers());
  if (!(await verificarCaptcha(String(fd?.get("cf-turnstile-response") ?? ""), ip))) redirect(`${voltar}?captcha=1`);
  if (ip && !(await usarCota(`demo:${ip}`, DEMOS_POR_IP, UMA_HORA))) {
    await registrarEvento("demo_limite_ip");
    redirect(`${voltar}?limite=1`);
  }
  let nova: Awaited<ReturnType<typeof criarContaDemo>>;
  try {
    nova = await criarContaDemo(tipo);
  } catch (e) {
    if (!(e instanceof LimiteDemonstracoes)) throw e;
    await registrarEvento("demo_limite_global");
    redirect(`${voltar}?limite=1`);
  }
  if (!nova) redirect("/?demo=indisponivel");
  await criarSessao(nova.usuario.id, { contaId: nova.conta.id, lembrar: false });
  redirect("/app/hoje");
}
