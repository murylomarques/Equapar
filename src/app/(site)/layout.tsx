import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE, dadoSite } from "@/lib/site";
import { LinkEntrar } from "@/components/link-entrar";
import { MenuSite } from "@/components/menu-site";
import "./site.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 5.1: faixa da jornada. Liga com SITE_FAIXA_JORNADA=true depois que o dono aprovar o texto */}
      {process.env.SITE_FAIXA_JORNADA === "true" && (
        <div className="site-faixa">
          <div className="site-largura">
            {/* texto sugerido no prompt; passa pelo dono (trava 6) */}
            A jornada caiu para 40 horas. Seus contratos com o governo precisam ser recalculados.{" "}
            <Link href="/guias/jornada-40-horas-contratos-publicos">Entenda o prazo</Link>
          </div>
        </div>
      )}
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
              {dadoSite(SITE.whatsapp) && <span>WhatsApp {dadoSite(SITE.whatsapp)}</span>}
            </nav>
          </div>
          <p className="legenda mt-24" style={{ color: "#b9b6ae" }}>
            {[dadoSite(SITE.razaoSocial), dadoSite(SITE.cnpj) && `CNPJ ${dadoSite(SITE.cnpj)}`, dadoSite(SITE.endereco)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </footer>
    </>
  );
}
