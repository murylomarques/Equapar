import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { soDigitos } from "@/lib/cnpj";
import { FormCriarConta, FormEmpresa } from "../formularios";

export const metadata: Metadata = { title: "Criar conta | Equapar" };

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ cnpj?: string; tipo?: string; etapa?: string }> }) {
  const sp = await searchParams;
  const s = await sessaoAtual();
  if (s && !s.pendente2fa) {
    const temConta = await db.membro.findFirst({ where: { usuarioId: s.usuarioId } });
    if (temConta) redirect("/app/hoje");
    return (
      <div className="cartao">
        <h1>Sua empresa</h1>
        <p className="secundario">Falta só dizer de qual empresa são os contratos.</p>
        <FormEmpresa />
      </div>
    );
  }
  return (
    <div className="cartao">
      <h1>Criar conta</h1>
      <FormCriarConta cnpj={sp.cnpj ? soDigitos(sp.cnpj) : undefined} tipoInicial={sp.tipo === "assessoria" ? "ASSESSORIA" : "EMPRESA"} google={!!process.env.GOOGLE_CLIENT_ID} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
