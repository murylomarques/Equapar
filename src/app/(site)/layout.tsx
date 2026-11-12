import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";
import { sessaoAtual } from "@/lib/auth";
import "./site.css";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await sessaoAtual();
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
            {s && !s.pendente2fa ? (
              <Link href="/app/hoje" className="btn btn-texto">
                Abrir a Equapar
              </Link>
            ) : (
              <Link href="/entrar" className="btn btn-texto">
                Entrar
              </Link>
            )}
            <Link href="/raio-x" className="btn btn-primario so-desktop">
              Fazer o Raio-X grátis
            </Link>
            <details className="menu so-celular">
              <summary className="btn" aria-label="Abrir menu">
                Menu
              </summary>
              <div className="menu-painel">
                <Link href="/raio-x">Fazer o Raio-X grátis</Link>
                <Link href="/#como-funciona">Como funciona</Link>
                <Link href="/precos">Preços</Link>
                <Link href="/assessorias">Para assessorias</Link>
                <Link href="/guias">Guias</Link>
              </div>
            </details>
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
