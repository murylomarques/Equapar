import Link from "next/link";
import { redirect } from "next/navigation";
import { FormEntrar } from "../formularios";
import { sessaoAtual } from "@/lib/auth";
import { metaPagina } from "@/app/(site)/seo";
import { googleAtivo } from "@/lib/chaves";

export const metadata = metaPagina({ titulo: "Entrar | Equapar", caminho: "/entrar" });

export default async function Entrar({ searchParams }: { searchParams: Promise<{ destino?: string; erro?: string; redefinida?: string }> }) {
  const { destino, erro, redefinida } = await searchParams;
  // A5: o site não consulta a sessão no navegador; quem já entrou e clica em "Entrar" vai direto ao app
  const s = await sessaoAtual();
  if (s && !s.pendente2fa && !erro) redirect(destino?.startsWith("/app") ? destino : "/app/hoje");
  return (
    <div className="cartao">
      <h1>Entrar</h1>
      {redefinida && (
        <p className="salvo" role="status">
          Senha nova salva. As sessões abertas foram encerradas; entre com a senha nova.
        </p>
      )}
      {erro && (
        <p className="erro-texto" role="alert">
          {erro === "google" ? "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha." : "Sua sessão terminou. Entre de novo."}
        </p>
      )}
      <FormEntrar destino={destino} google={googleAtivo()} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        <Link href="/esqueci-senha">Esqueci minha senha</Link>
        <br />
        Ainda não tem conta? <Link href="/criar-conta">Criar conta</Link> · <a href="/demonstracao">Ver a demonstração</a>
      </p>
    </div>
  );
}
