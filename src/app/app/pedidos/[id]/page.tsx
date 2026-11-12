import { redirect } from "next/navigation";
import { contexto, pedidoDaConta } from "@/lib/auth";

export default async function PedidoIndice({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto();
  const { id } = await params;
  const p = await pedidoDaConta(ctx, id);
  if (p.estado !== "EM_ANALISE") redirect(`/app/pedidos/${p.id}/pronto`);
  redirect(`/app/pedidos/${p.id}/passo/${p.passoAtual}`);
}
