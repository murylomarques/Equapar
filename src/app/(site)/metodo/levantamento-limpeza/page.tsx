import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Como contamos as empresas de limpeza com contratos vigentes | Equapar",
  description: "Fonte, termos de busca, o que conta, o que fica fora, agrupamento por CNPJ e limites do levantamento no PNCP.",
};

/** A7: método do levantamento. Trava 8: a página não publica a lista de empresas. */
export default function MetodoLevantamento() {
  const { empresas, data } = SITE.levantamentoLimpeza;
  return (
    <article className="site-largura secao guia">
      <h1 className="titulo-landing" style={{ fontSize: 38 }}>
        Como chegamos a {empresas} empresas com contratos de limpeza vigentes
      </h1>
      <p className="secundario" style={{ fontSize: 18 }}>
        O número da página inicial vem de um levantamento nos dados públicos do PNCP. Aqui está o método, para quem quiser conferir ou refazer. A lista de empresas não é publicada.
      </p>
      <h2>Fonte e data</h2>
      <p>
        API pública do Portal Nacional de Contratações Públicas (PNCP), busca de contratos com situação vigente, extraída em {data}. Termos de busca: limpeza, conservação, asseio, servente e higienização, nas 27 unidades da federação.
      </p>
      <h2>Contratos que contam</h2>
      <p>Só prestação de serviço de limpeza, asseio e conservação predial ou hospitalar, com ou sem material. Só os tipos Contrato, Carta Contrato e Outros; empenhos ficam fora.</p>
      <h2>O que fica fora</h2>
      <p>Compra de material, limpeza urbana, coleta de resíduos, fossas, caixas d&apos;água, ar-condicionado, dedetização, terrenos, vias, lavanderia e eventos.</p>
      <h2>Empresas que contam</h2>
      <p>
        Só pessoa jurídica com CNPJ. Ficam fora pessoa física, empresário individual, cooperativas, associações e órgãos públicos. Os contratos são agrupados pela raiz do CNPJ (matriz e filiais juntas), sem duplicatas.
      </p>
      <h2>Resultado</h2>
      <p>{empresas} empresas com contratos de limpeza vigentes.</p>
      <h2>Limites</h2>
      <ul>
        <li>O PNCP só tem o que os órgãos publicaram, com mais força a partir de 2023; contratos antigos prorrogados podem faltar.</li>
        <li>O valor é o inicial, sem aditivos.</li>
        <li>&ldquo;Vigente&rdquo; segue a data de fim publicada.</li>
      </ul>
      <h2>Como refazer a consulta</h2>
      <ol>
        <li>Consulte a API de contratos do PNCP com os termos acima, em cada UF, filtrando a situação vigente.</li>
        <li>Mantenha só os tipos Contrato, Carta Contrato e Outros e só os objetos de limpeza, asseio e conservação predial ou hospitalar.</li>
        <li>Descarte os CNPJs de pessoa física, empresário individual, cooperativa, associação e órgão público.</li>
        <li>Agrupe pela raiz do CNPJ (os 8 primeiros caracteres) e conte as raízes distintas.</li>
      </ol>
      <p>
        Fonte:{" "}
        <a href="https://pncp.gov.br/api/consulta/swagger-ui/index.html" target="_blank" rel="noreferrer">
          API de consulta do PNCP
        </a>
        .
      </p>
    </article>
  );
}
