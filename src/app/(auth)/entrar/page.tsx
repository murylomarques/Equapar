import type { Metadata } from "next";
import Link from "next/link";
import { FormEntrar } from "../formularios";

export const metadata: Metadata = { title: "Entrar | Equapar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ destino?: string; erro?: string }> }) {
  const { destino, erro } = await searchParams;
  return (
    <div className="cartao">
      <h1>Entrar</h1>
      {erro && (
        <p className="erro-texto" role="alert">
          {erro === "google" ? "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha." : "Sua sessão terminou. Entre de novo."}
        </p>
      )}
      <FormEntrar destino={destino} google={!!process.env.GOOGLE_CLIENT_ID} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        Ainda não tem conta? <Link href="/criar-conta">Criar conta</Link> · <a href="/demonstracao">Ver a demonstração</a>
      </p>
    </div>
  );
}
