import Link from "next/link";
import { FormCnpjServidor } from "@/components/form-cnpj-servidor";
import { GUIAS } from "@/lib/guias";
import { guiaNoAr } from "@/lib/chaves";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Guias de repactuação de contratos públicos | Equapar",
  descricao: "Repactuação pela Lei 14.133, prorrogação com ressalva, data-base da convenção coletiva e prazos de resposta, explicados com as fontes.",
  caminho: "/guias",
});

export default function Guias() {
  return (
    <div className="site-largura secao">
      <h1 className="titulo-landing">Guias de repactuação</h1>
      <p className="secundario leitura">Regras, prazos e documentos da repactuação de contratos públicos com mão de obra, com as fontes de cada ponto.</p>
      <div className="guias-grade mt-24">
        <ul className="lista-limpa guias-lista">
          {GUIAS.filter((g) => guiaNoAr(g.slug)).map((g) => (
            <li key={g.slug}>
              <Link href={`/guias/${g.slug}`} className="cartao-linha guia-cartao">
                <h2 className="guia-cartao-titulo">{g.titulo}</h2>
                <span className="secundario">{g.descricao}</span>
                <span className="guia-cartao-acao" aria-hidden>
                  Ler guia →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* a mesma chamada do fim de cada guia, ao lado da lista no computador */}
        <aside className="cartao guia-chamada guias-chamada" aria-labelledby="guias-chamada-titulo">
          <h2 id="guias-chamada-titulo">Veja os prazos dos seus contratos</h2>
          <p className="secundario">Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.</p>
          <FormCnpjServidor id="cnpj-guias" />
        </aside>
      </div>
    </div>
  );
}
