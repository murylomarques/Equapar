import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NaoEncontrado() {
  return (
    <main id="conteudo" style={{ maxWidth: 560, margin: "80px auto", padding: "0 16px" }}>
      <Logo largura={110} />
      <h1 className="mt-24">Página não encontrada</h1>
      <p className="secundario">O endereço pode ter mudado ou o item não pertence a esta conta.</p>
      <div className="fileira">
        <Link href="/" className="btn">
          Início
        </Link>
        <Link href="/app/hoje" className="btn btn-primario">
          Abrir a Equapar
        </Link>
      </div>
    </main>
  );
}
