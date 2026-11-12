import type { Metadata } from "next";
import Link from "next/link";
import { FormEntrar } from "../formularios";

export const metadata: Metadata = { title: "Entrar | Equapar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ destino?: string; erro?: string; redefinida?: string }> }) {
  const { destino, erro, redefinida } = await searchParams;
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
      <FormEntrar destino={destino} google={!!process.env.GOOGLE_CLIENT_ID} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        <Link href="/esqueci-senha">Esqueci minha senha</Link>
        <br />
        Ainda não tem conta? <Link href="/criar-conta">Criar conta</Link> · <a href="/demonstracao">Ver a demonstração</a>
      </p>
    </div>
  );
}
