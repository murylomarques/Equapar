import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";
import { LinkEntrar } from "@/components/link-entrar";
import { MenuSite } from "@/components/menu-site";
import "./site.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-topo">
        <div className="site-largura site-topo-in">
          <Logo largura={118} />
          <nav aria-label="Principal" className="site-nav">
            <Link href="/#como-funciona">Como funciona</Link>
            <Link href="/precos">Preços</Link>
            <Link href="/assessorias">Para assessorias</Link>
            <Link href="/guias">Guias</Link>
          </nav>
          <div className="fileira">
            <LinkEntrar />
            <Link href="/raio-x" className="btn btn-primario so-desktop">
              Fazer o Raio-X grátis
            </Link>
            <MenuSite />
          </div>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="site-rodape">
        <div className="site-largura">
          <div className="entre" style={{ alignItems: "flex-start" }}>
            <div className="pilha-8">
              <Logo negativo largura={110} />
              <small style={{ color: "#b9b6ae" }}>Cada repactuação no prazo, com prova.</small>
            </div>
            <nav aria-label="Rodapé" className="pilha-8">
              <Link href="/privacidade">Política de privacidade</Link>
              <Link href="/termos">Termos de uso</Link>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              <span>WhatsApp {SITE.whatsapp}</span>
            </nav>
          </div>
          <p className="legenda mt-24" style={{ color: "#b9b6ae" }}>
            {SITE.razaoSocial} · CNPJ {SITE.cnpj} · {SITE.endereco}
          </p>
        </div>
      </footer>
    </>
  );
}
