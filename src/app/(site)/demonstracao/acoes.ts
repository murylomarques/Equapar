"use server";
import { redirect } from "next/navigation";
import { criarSessao, ehDemo, sessaoAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { EMAIL_DEMO } from "@/lib/site";

/**
 * Entra na demonstração (POST). Um GET em /demonstracao nunca abre sessão (C6), e quem já está
 * conectado numa conta real não é trocado de conta: a página mostra o aviso.
 */
export async function entrarNaDemonstracao() {
  const s = await sessaoAtual();
  if (s && !s.pendente2fa && !ehDemo(s)) redirect("/demonstracao");
  if (s && ehDemo(s)) redirect("/app/hoje");
  const u = await db.usuario.findUnique({ where: { email: EMAIL_DEMO }, include: { membros: true } });
  if (!u || !u.membros.length) redirect("/?demo=indisponivel");
  await criarSessao(u.id, { contaId: u.membros[0].contaId, lembrar: false });
  redirect("/app/hoje");
}
