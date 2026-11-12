import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { idDoToken, lerTokenRedefinicao } from "@/lib/redefinir-senha";
import { FormRedefinirSenha } from "../formularios";

export const metadata: Metadata = { title: "Criar senha nova | Equapar" };

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const id = idDoToken(t);
  const u = id ? await db.usuario.findUnique({ where: { id }, select: { id: true, senhaHash: true } }) : null;
  const valido = !!u && "ok" in lerTokenRedefinicao(t, u);
  return (
    <div className="cartao" style={{ maxWidth: 440, width: "100%" }}>
      {valido ? (
        <>
          <h1>Criar senha nova</h1>
          <p className="secundario">Depois de salvar, as sessões abertas são encerradas e você entra com a senha nova.</p>
          <FormRedefinirSenha token={t} />
        </>
      ) : (
        <>
          <h1>Este link não vale mais</h1>
          <p className="secundario">O link vence em 1 hora e serve uma vez só. Peça outro.</p>
          <Link href="/esqueci-senha" className="btn btn-primario">
            Pedir outro link
          </Link>
        </>
      )}
    </div>
  );
}
