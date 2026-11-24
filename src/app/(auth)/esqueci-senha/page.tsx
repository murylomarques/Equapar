import Link from "next/link";
import { FormEsqueciSenha } from "../formularios";
import { metaPagina } from "@/app/(site)/seo";

export const metadata = metaPagina({ titulo: "Esqueci minha senha | Equapar", caminho: "/esqueci-senha", indexar: false });

export default function EsqueciSenha() {
  return (
    <div className="cartao">
      <h1>Esqueci minha senha</h1>
      <p className="secundario">Digite o e-mail da sua conta. Mandamos um link para criar uma senha nova; ele vale por 1 hora e serve uma vez só.</p>
      <FormEsqueciSenha />
      <p className="mt-16 mb-0" style={{ fontSize: 14 }}>
        <Link href="/entrar">Voltar para Entrar</Link>
      </p>
    </div>
  );
}
