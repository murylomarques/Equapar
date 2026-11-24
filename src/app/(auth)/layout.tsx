import Link from "next/link";
import { Logo } from "@/components/logo";
// A5: toasts e confirmações só onde há formulários do produto (fora da landing)
import { Provedores } from "@/components/ui/provedores";
// as regras de largura e espaçamento das telas de acesso ficam junto das do site público
import "../(site)/site.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="auth-pagina">
      <div className="auth-coluna">
        <div className="auth-logo">
          <Logo largura={128} />
        </div>
        <div className="auth-conteudo">
          <Provedores>{children}</Provedores>
        </div>
        <p className="legenda auth-rodape">
          <Link href="/">← Voltar ao site</Link> · <Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link>
        </p>
      </div>
    </main>
  );
}
