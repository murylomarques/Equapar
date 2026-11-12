import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { Form2fa } from "../../formularios";
import { sair } from "../../acoes";

export default async function DoisFatores({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (!s.pendente2fa) redirect("/app/hoje");
  const { destino } = await searchParams;
  return (
    <div className="cartao">
      <h1>Verificação em duas etapas</h1>
      <p className="secundario">Abra o aplicativo autenticador e digite o código da Equapar.</p>
      <Form2fa destino={destino} />
      <form action={sair} className="mt-16">
        <button className="btn btn-texto" type="submit">
          Sair e voltar
        </button>
      </form>
    </div>
  );
}
