import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { lerTokenConfirmacao } from "@/lib/confirmacao-email";

export const metadata: Metadata = { title: "Confirmar e-mail | Equapar" };

/** C7: abre o link do e-mail e marca o e-mail como confirmado. */
export default async function ConfirmarEmail({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const r = t ? lerTokenConfirmacao(t) : ({ erro: "invalido" } as const);
  let ok = false;
  if (!("erro" in r)) {
    const u = await db.usuario.findUnique({ where: { id: r.usuarioId } });
    if (u && u.email.toLowerCase() === r.email) {
      if (!u.emailVerificadoEm) await db.usuario.update({ where: { id: u.id }, data: { emailVerificadoEm: new Date() } });
      ok = true;
    }
  }
  return (
    <div className="cartao" style={{ maxWidth: 440, width: "100%" }}>
      {ok ? (
        <>
          <CheckCircle2 size={32} strokeWidth={1.5} aria-hidden style={{ color: "var(--verde)" }} />
          <h1 className="mt-16">E-mail confirmado</h1>
          <p className="secundario">A partir de agora, os avisos de prazo chegam para você.</p>
          <Link href="/app/hoje" className="btn btn-primario">
            Abrir a Equapar
          </Link>
        </>
      ) : (
        <>
          <h1>Este link não vale mais</h1>
          <p className="secundario">
            {"erro" in r && r.erro === "vencido" ? "O link venceu (ele vale por 24 horas)." : "O link está incompleto ou foi alterado."} Entre na Equapar e peça um link novo no aviso do topo da tela.
          </p>
          <Link href="/entrar" className="btn btn-primario">
            Entrar
          </Link>
        </>
      )}
    </div>
  );
}
