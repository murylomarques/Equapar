import { sessaoAtual } from "@/lib/auth";

// Diz só se há sessão ativa (sem dados pessoais). Usado pelo topo do site, que é estático.
export async function GET() {
  const s = await sessaoAtual();
  return Response.json({ logado: !!s && !s.pendente2fa }, { headers: { "Cache-Control": "private, no-store" } });
}
