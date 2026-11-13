import Link from "next/link";
import { Logo } from "@/components/logo";
import { contatoSite, dadosEmpresa, telefoneFormatado } from "@/lib/site";
import { Contato } from "@/components/contato";
import { MenuSite } from "@/components/menu-site";
import "./site.css";
import { modoPiloto } from "@/lib/chaves";
import { jornadaLiberada } from "@/lib/chaves";

// A6/B1: as páginas do site são estáticas e se refazem a cada 60 s com o ambiente de execução (.env da imagem).
// Depois de subir ou mudar uma chave, o site reflete o .env em até 1 minuto. As rotas escondidas valem na hora (proxy).
export const revalidate = 60;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const empresa = dadosEmpresa();
  const contato = contatoSite();
  return (
    <>
      {/* 5.1: faixa da jornada. Liga com SITE_FAIXA_JORNADA=true depois que o dono aprovar o texto */}
      {process.env.SITE_FAIXA_JORNADA === "true" && jornadaLiberada() && (
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
            {!modoPiloto() && <Link href="/assessorias">Para assessorias</Link>}
            <Link href="/guias">Guias</Link>
          </nav>
          <div className="fileira">
            <Link href="/entrar" className="btn btn-texto">
              Entrar
            </Link>
            <Link href="/raio-x" className="btn btn-primario so-desktop">
              Fazer o Raio-X grátis
            </Link>
            <MenuSite ocultar={modoPiloto() ? ["/assessorias"] : []} />
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
              <Contato agenda={false} />
              <a href={contato.emailLink}>{contato.email}</a>
              {contato.whatsapp && contato.whatsappLink && <a href={contato.whatsappLink}>WhatsApp {telefoneFormatado(contato.whatsapp)}</a>}
            </nav>
          </div>
          <p className="legenda mt-24" style={{ color: "#b9b6ae" }}>
            {[empresa.razaoSocial, empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.local].filter(Boolean).join(" · ")}
          </p>
        </div>
      </footer>
    </>
  );
}
