import Link from "next/link";
import { Logo } from "@/components/logo";
import { contatoSite, dadosEmpresa } from "@/lib/site";
import { Contato } from "@/components/contato";
import { MenuSite } from "@/components/menu-site";
import { jornadaLiberada, modoPiloto } from "@/lib/chaves";

/** Topo e rodapé do site público. Usados pelo layout do site e pela página "não encontrada". */
// Cabeçalho e rodapé do site: sem prefetch (medido: os prefetches dos links visíveis somavam trabalho no carregamento
// das páginas públicas sem ganho real; a navegação continua normal ao clicar).
export function TopoSite() {
  return (
    <>
      {/* 5.1: faixa da jornada. Liga com SITE_FAIXA_JORNADA=true depois que o dono aprovar o texto */}
      {process.env.SITE_FAIXA_JORNADA === "true" && jornadaLiberada() && (
        <div className="site-faixa">
          <div className="site-largura">
            {/* texto alinhado ao guia aprovado pelo advogado (datas da EC 141/2026) */}
            A jornada máxima cai para 42 horas em 16/12/2026 e para 40 horas em 16/12/2027. Contratos públicos com mão de obra precisam de aditivo.{" "}
            <Link prefetch={false} href="/guias/jornada-40-horas-contratos-publicos">Entenda o prazo</Link>
          </div>
        </div>
      )}
      <header className="site-topo">
        <div className="site-largura site-topo-in">
          <Logo largura={118} />
          <nav aria-label="Principal" className="site-nav">
            <Link prefetch={false} href="/#como-funciona">Como funciona</Link>
            <Link prefetch={false} href="/precos">Preços</Link>
            {!modoPiloto() && <Link prefetch={false} href="/assessorias">Para assessorias</Link>}
            <Link prefetch={false} href="/guias">Guias</Link>
          </nav>
          <div className="fileira">
            <Link prefetch={false} href="/entrar" className="btn btn-texto">
              Entrar
            </Link>
            <Link prefetch={false} href="/raio-x" className="btn btn-primario so-desktop">
              Fazer o Raio-X grátis
            </Link>
            <MenuSite ocultar={modoPiloto() ? ["/assessorias"] : []} />
          </div>
        </div>
      </header>
    </>
  );
}

export function RodapeSite() {
  const empresa = dadosEmpresa();
  const contato = contatoSite();
  const nome = empresa.razaoSocial;
  return (
    <footer className="site-rodape">
      <div className="site-largura">
        <div className="rodape-grade">
          <div className="pilha-8">
            <Logo negativo largura={110} />
            <small className="rodape-apoio">Cada repactuação no prazo, com prova.</small>
          </div>
          <nav aria-label="Produto" className="rodape-coluna">
            <Link prefetch={false} href="/raio-x">Raio-X grátis</Link>
            <Link prefetch={false} href="/#como-funciona">Como funciona</Link>
            <Link prefetch={false} href="/software-de-repactuacao">Software de repactuação</Link>
            <Link prefetch={false} href="/precos">Preços</Link>
            <Link prefetch={false} href="/guias">Guias</Link>
          </nav>
          <nav aria-label="Rodapé" className="rodape-coluna">
            <Link prefetch={false} href="/privacidade">Política de privacidade</Link>
            <Link prefetch={false} href="/termos">Termos de uso</Link>
            {/* um canal só por vez: o botão ao lado já é o e-mail (ou o WhatsApp, quando houver); o e-mail em texto
                aparece só quando o botão é o WhatsApp */}
            {contato.whatsappLink && <a href={contato.emailLink}>{contato.email}</a>}
          </nav>
          <div className="rodape-coluna">
            <Contato agenda={false} />
          </div>
        </div>
        <p className="rodape-empresa">
          <span>
            © {new Date().getFullYear()} {nome}
          </span>
          {empresa.cnpj && <span>CNPJ {empresa.cnpj}</span>}
          {/* sem CNPJ: a pessoa física responsável (Decreto 7.962/2013, art. 2º) */}
          {!empresa.cnpj && empresa.cpf && empresa.responsavelNome && (
            <span>
              {empresa.responsavelNome} · CPF {empresa.cpf}
            </span>
          )}
          {empresa.local && <span>{empresa.local}</span>}
        </p>
      </div>
    </footer>
  );
}
