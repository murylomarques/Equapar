import Link from "next/link";
import { FormCnpjServidor } from "@/components/form-cnpj-servidor";
import { TabelaPlanos } from "@/components/planos";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { COMPARACAO, etapas } from "@/lib/site-conteudo";
import { jsonLdEquapar, jsonLdPerguntas, metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Software de repactuação de contratos públicos | Equapar",
  descricao:
    "Software de repactuação para empresas terceirizadas: avisa os prazos, refaz a planilha pela convenção nova, gera ofício e memória de cálculo e acompanha até receber.",
  caminho: "/software-de-repactuacao",
});

/** O que a empresa recebe em cada pedido (documentos que o produto gera hoje). */
const ENTREGAS = [
  ["Planilha de custos nova", "Refeita a partir da planilha da proposta e da convenção coletiva nova, item a item."],
  ["Memória de cálculo", "Cada número com a origem: a cláusula da convenção, o percentual ou a regra usada."],
  ["Ofício do pedido", "Pronto para revisar e protocolar, com o novo valor mensal e os anexos."],
  ["Retroativo", "A diferença desde a data de efeitos, mês a mês, para cobrar o que ficou para trás."],
] as const;

const PARA_QUEM = [
  "Empresas de limpeza e conservação com contratos públicos.",
  "Empresas de portaria, recepção e outros serviços com mão de obra dedicada.",
  "Quem tem vários contratos e não quer depender de lembrete na planilha.",
  "Assessorias e contadores que cuidam da repactuação de clientes.",
] as const;

function perguntas() {
  return [
    ["O que é um software de repactuação?", "É um sistema que controla os contratos públicos com mão de obra: avisa quando a convenção coletiva muda e o prazo do pedido se aproxima, refaz a planilha de custos e gera os documentos do pedido, até o dinheiro da diferença entrar."],
    ["Preciso instalar alguma coisa?", "Não. A Equapar funciona no navegador, no computador e no celular."],
    ["É seguro digitar meu CNPJ?", "Sim. O Raio-X só consulta dados públicos do PNCP. Não pedimos senha, certificado ou documento."],
    ["A Equapar protocola o pedido por mim?", "Não. Você protocola pelo canal do contrato. A Equapar entrega tudo pronto e guarda o número do protocolo."],
    [
      "Substitui meu advogado ou contador?",
      revisaoEspecialistaAtiva()
        ? "Não. Organiza prazos, conta e documentos. Casos complexos podem ter revisão de especialista, cobrada à parte."
        : "Não. Organiza prazos, conta e documentos. Em casos complexos, revise o pedido com o seu advogado ou contador antes de protocolar.",
    ],
    ["Serve para reajuste por índice?", "Avisa o prazo e mostra a cláusula. A conta completa é para repactuação de contratos com mão de obra."],
    ["Como cancelo?", "Na tela de cobrança, a qualquer momento. Seus dados ficam disponíveis para exportar."],
  ] as const;
}

export default function SoftwareDeRepactuacao() {
  const faq = perguntas();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdEquapar() }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdPerguntas(faq) }} />
      <div className="site-largura secao">
        <p className="sobretitulo">Para empresas terceirizadas com contratos públicos</p>
        <h1 className="titulo-landing">Software de repactuação de contratos públicos</h1>
        <p className="secundario leitura guia-descricao">
          A Equapar avisa os prazos de cada contrato, refaz a planilha de custos pela convenção coletiva nova, gera o ofício e a memória de cálculo e acompanha o pedido até o dinheiro entrar.
        </p>
        <div className="mt-24">
          <FormCnpjServidor id="cnpj-software" />
          <p className="legenda mb-0">Raio-X grátis: veja agora os contratos vigentes da sua empresa no PNCP e quando cada um termina.</p>
        </div>

        <section className="mt-48" aria-labelledby="sw-como">
          <h2 id="sw-como" className="titulo-secao">
            Do contrato ao dinheiro na conta
          </h2>
          <ol className="etapas lista-limpa">
            {etapas().map(([titulo, texto], i) => (
              <li key={titulo} className="etapa">
                <span className="etapa-num" aria-hidden>
                  {i + 1}
                </span>
                <h3>{titulo}</h3>
                <p className="secundario mb-0">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-48" aria-labelledby="sw-entregas">
          <h2 id="sw-entregas" className="titulo-secao">
            O que sai pronto em cada pedido
          </h2>
          <ul className="lista-limpa sw-entregas">
            {ENTREGAS.map(([titulo, texto]) => (
              <li key={titulo} className="cartao-linha">
                <strong>{titulo}</strong>
                <span className="secundario" style={{ display: "block" }}>
                  {texto}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-16">
            <a href="/demonstracao" className="btn btn-primario">
              Ver a demonstração
            </a>
          </p>
        </section>

        <section className="mt-48" aria-labelledby="sw-quem">
          <h2 id="sw-quem" className="titulo-secao">
            Para quem é
          </h2>
          <ul className="leitura">
            {PARA_QUEM.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="mt-48" aria-labelledby="sw-comparar">
          <h2 id="sw-comparar" className="titulo-secao">
            Planilha, consultoria ou software
          </h2>
          <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Comparação: planilha, consultoria e Equapar">
            <table className="tabela tabela-comparacao">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Critério</span>
                  </th>
                  <th scope="col">Planilha e memória</th>
                  <th scope="col">Consultoria por pedido</th>
                  <th scope="col">Equapar</th>
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map(([criterio, planilha, consultoria, equapar]) => (
                  <tr key={criterio}>
                    <th scope="row">{criterio}</th>
                    <td>{planilha}</td>
                    <td>{consultoria}</td>
                    <td>{equapar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-48" aria-labelledby="sw-precos">
          <h2 id="sw-precos" className="titulo-secao">
            Quanto custa
          </h2>
          <TabelaPlanos />
          <p className="mt-16">
            <Link href="/precos" className="link-seta">
              Calculadora e comparação completa dos planos
            </Link>
          </p>
        </section>

        <section className="mt-48 faq" aria-labelledby="sw-faq">
          <h2 id="sw-faq" className="titulo-secao">
            Perguntas frequentes
          </h2>
          {faq.map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </section>

        <section className="mt-48" aria-labelledby="sw-guias">
          <h2 id="sw-guias" className="titulo-secao">
            Aprenda sobre repactuação
          </h2>
          <p className="secundario leitura">
            Prazos, documentos, cálculo e prorrogação, explicados com as fontes. <Link href="/guias">Ver todos os guias</Link>.
          </p>
        </section>

        <section className="cartao guia-chamada mt-48" aria-labelledby="sw-chamada">
          <h2 id="sw-chamada">Seus contratos já estão no PNCP. Veja os prazos agora.</h2>
          <FormCnpjServidor id="cnpj-software-fim" />
          <p className="legenda mb-0">Grátis, sem senha e sem cadastro.</p>
        </section>
      </div>
    </>
  );
}
