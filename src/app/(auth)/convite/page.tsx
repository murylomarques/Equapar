import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { conviteValido, lerTokenConvite } from "@/lib/convite";
import { FormAceitarConvite } from "../formularios";

export const metadata: Metadata = { title: "Convite | Equapar" };

/** S12: abre o link do convite e mostra o formulário para criar a senha. */
export default async function Convite({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const tok = lerTokenConvite(t);
  const u = tok ? await db.usuario.findUnique({ where: { id: tok.usuarioId }, select: { id: true, nome: true, email: true, senhaHash: true } }) : null;
  const conta = tok ? await db.conta.findUnique({ where: { id: tok.contaId }, select: { nome: true } }) : null;
  const situacao = conviteValido(tok, u);
  return (
    <div className="cartao" style={{ maxWidth: 440, width: "100%" }}>
      {situacao === "ok" && u && conta ? (
        <>
          <h1>Bem-vindo, {u.nome.split(" ")[0]}</h1>
          <p className="secundario">
            Você foi convidado para a conta <strong>{conta.nome}</strong>. Crie uma senha para o e-mail {u.email}.
          </p>
          <FormAceitarConvite token={t} />
        </>
      ) : situacao === "usado" ? (
        <>
          <h1>Convite já aceito</h1>
          <p className="secundario">A senha desta conta já foi criada. Entre com o seu e-mail e a sua senha.</p>
          <Link href="/entrar" className="btn btn-primario">
            Entrar
          </Link>
        </>
      ) : (
        <>
          <h1>Este convite não vale mais</h1>
          <p className="secundario">O convite vale por 7 dias. Peça um novo a quem convidou você.</p>
        </>
      )}
    </div>
  );
}
