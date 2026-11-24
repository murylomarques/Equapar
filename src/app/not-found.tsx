import type { Metadata } from "next";
import Link from "next/link";
import "./(site)/site.css";
import { RodapeSite, TopoSite } from "./(site)/moldura";

export const metadata: Metadata = { title: "Página não encontrada | Equapar" };

/** 404 de todo o sistema (site, rotas escondidas pelo modo piloto e itens do app que não pertencem à conta). */
export default function NaoEncontrado() {
  return (
    <div className="site-pagina">
      <TopoSite />
      <main id="conteudo">
        <div className="site-largura secao">
          <div className="nao-encontrada">
            <p className="sobretitulo">Erro 404</p>
            <h1 className="titulo-landing">Página não encontrada</h1>
            <p className="secundario leitura">
              O endereço pode ter mudado ou a página não existe mais. Se você abriu um link da sua conta, o item pode não pertencer a ela.
            </p>
            <div className="fileira mt-24">
              <Link href="/raio-x" className="btn btn-primario">
                Ver os prazos pelo CNPJ
              </Link>
              <Link href="/guias" className="btn">
                Ler os guias de repactuação
              </Link>
            </div>
            <p className="legenda mt-24 mb-0">
              <Link href="/">Voltar ao início</Link> · Já é cliente? <Link href="/app/hoje">Abrir a Equapar</Link>
            </p>
          </div>
        </div>
      </main>
      <RodapeSite />
    </div>
  );
}
