"use server";
import { redirect } from "next/navigation";
import { criarSessao, ehDemo, sessaoAtual } from "@/lib/auth";
import { criarContaDemo } from "@/lib/demo";

/**
 * Entra na demonstração (POST). Um GET em /demonstracao nunca abre sessão (C6), e quem já está
 * conectado numa conta real não é trocado de conta: a página mostra o aviso.
 */
export async function entrarNaDemonstracao() {
  const s = await sessaoAtual();
  if (s && !s.pendente2fa && !ehDemo(s)) redirect("/demonstracao");
  if (s && ehDemo(s)) redirect("/app/hoje");
  // C6.2: cada visitante ganha a própria cópia dos dados fictícios (4 horas) e pode montar um pedido
  const nova = await criarContaDemo();
  if (!nova) redirect("/?demo=indisponivel");
  await criarSessao(nova.usuario.id, { contaId: nova.conta.id, lembrar: false });
  redirect("/app/hoje");
}
