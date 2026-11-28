/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { FormCnpjServidor } from "@/components/form-cnpj-servidor";
import { PreviaCarteira, PreviaHoje, PreviaMemoria, PreviaPronto, PreviaReceber } from "@/components/previas";
import { Revelar } from "@/components/revelar";
import { SITE, dadosEmpresa } from "@/lib/site";
import { COMPARACAO, etapas } from "@/lib/site-conteudo";
import { TabelaPlanos } from "@/components/planos";
import { FONTES } from "@/lib/prazos";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { guiaNoAr } from "@/lib/chaves";
import { jsonLdEquapar, metaPagina } from "./seo";

export const metadata = metaPagina({
  titulo: "Repactuação de contratos públicos no prazo | Equapar",
  descricao:
    "Controle de repactuação para empresas de limpeza, portaria e recepção com contratos públicos: prazos, memória de cálculo e documentos até o recebimento. Raio-X grátis pelo CNPJ.",
  caminho: "/",
});

const GUIA_REFORMA = "reforma-tributaria-contratos-publicos-reequilibrio";

const PERGUNTAS = () =>
  [
    ["É seguro digitar meu CNPJ?", "Sim. O Raio-X só consulta dados públicos do PNCP. Não pedimos senha, certificado ou documento."],
    ["A Equapar protocola o pedido por mim?", "Não. Você protocola pelo canal do contrato. A Equapar entrega tudo pronto e guarda o número do protocolo."],
    [
      "Substitui meu advogado ou contador?",
      revisaoEspecialistaAtiva()
        ? "Não. Organiza prazos, conta e documentos. Casos complexos podem ter revisão de especialista, cobrada à parte."
        : "Não. Organiza prazos, conta e documentos. Em casos complexos, revise o pedido com o seu advogado ou contador antes de protocolar.",
    ],
    ["Serve para reajuste por índice?", "Avisa o prazo e mostra a cláusula. A conta completa é para repactuação de contratos com mão de obra."],
    [
      "E a reforma tributária?",
      // o guia da reforma fica escondido no modo piloto: o link só aparece com ele no ar
      <>
        Contratos assinados antes da LC 214/2025, ou com proposta anterior a ela, podem ter direito ao reequilíbrio previsto na lei. A Equapar marca quais são; o cálculo da carga
        tributária ainda não faz parte do produto.
        {guiaNoAr(GUIA_REFORMA) && (
          <>
            {" "}
            <Link href={`/guias/${GUIA_REFORMA}`}>Leia o guia</Link>.
          </>
        )}
      </>,
    ],
    ["Como cancelo?", "Na tela de cobrança, a qualquer momento. Seus dados ficam disponíveis para exportar."],
  ] as const;

export default function Landing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdEquapar() }} />

      {/* 1. Abertura: para quem, problema, resultado e o Raio-X */}
      <div className="site-largura">
        <section className="abertura" aria-labelledby="titulo-abertura">
          <div>
            <p className="sobretitulo">Para empresas de limpeza, portaria e recepção com contratos públicos</p>
            {/* 5.4: a promessa vira título com SITE_TITULO_PROMESSA=true, depois que o dono aprovar o texto (trava 6) */}
            {process.env.SITE_TITULO_PROMESSA === "true" ? (
              <>
                <h1 id="titulo-abertura" className="titulo-landing">
                  Cada repactuação no prazo, com prova.
                </h1>
                <p className="titulo-apoio">A convenção subiu. O seu contrato com o governo também pode subir.</p>
              </>
            ) : (
              <h1 id="titulo-abertura" className="titulo-landing">
                A convenção subiu. O seu contrato com o governo também pode subir.
              </h1>
            )}
            <p className="abertura-texto leitura">
              A Equapar é o controle de repactuação dos seus contratos públicos: avisa os prazos de cada contrato, gera a memória de cálculo e os arquivos editáveis e acompanha o
              pedido até a diferença entrar no caixa. Você confere e protocola.
            </p>
            <div className="mt-24">
              <FormCnpjServidor id="cnpj-abertura" />
              <p className="legenda abertura-legenda">Raio-X grátis: só dados públicos do PNCP, sem senha e sem cadastro.</p>
              <a href="/demonstracao" className="link-seta">
                Ou veja a demonstração com dados fictícios
              </a>
            </div>
          </div>
          <PreviaHoje />
        </section>
      </div>

      {/* 2. O problema, com as fontes */}
      <Revelar className="secao secao-faixa">
        <div className="site-largura">
          <h2 className="titulo-secao">Onde o dinheiro fica na mesa</h2>
          <p className="secundario leitura secao-intro">
            Prazo da prorrogação, convenção nova, planilha refeita, documentação, protocolo e cobrança da diferença: basta uma etapa escapar para o contrato seguir pagando o valor antigo.
          </p>
          <ul className="problemas lista-limpa">
            <li className="problema">
              <h3>A convenção subiu em janeiro. O pedido não saiu.</h3>
              <p className="secundario">O piso aumentou, a folha aumentou, e o contrato continua pagando o valor antigo.</p>
              <div className="documento" aria-label="Recorte de planilha de custos com dados borrados">
                <div className="entre">
                  <strong>Planilha de custos · Módulo 1</strong>
                  <span className="borrado">Contrato 00/0000</span>
                </div>
                <div className="entre">
                  <span>Salário base (piso)</span>
                  <span className="num borrado">R$ 0.000,00</span>
                </div>
                <div className="entre">
                  <span>Insalubridade</span>
                  <span className="num borrado">R$ 000,00</span>
                </div>
              </div>
            </li>
            <li className="problema">
              <h3>A prorrogação foi assinada sem ressalva.</h3>
              <p className="secundario">Para o TCU, quem prorroga sem pedir a repactuação aceita as condições antigas.</p>
              <div className="documento" aria-label="Recorte de termo aditivo com dados borrados">
                <strong>Termo aditivo de prorrogação</strong>
                <p className="mb-0">
                  Fica prorrogado o prazo de vigência do contrato nº <span className="borrado">00/0000</span> por mais 12 meses, mantidas as demais cláusulas…
                </p>
              </div>
            </li>
            <li className="problema">
              <h3>O pedido foi deferido. A diferença nunca foi cobrada.</h3>
              <p className="secundario">Sem apostilamento e sem fatura da diferença, o dinheiro não entra.</p>
              <div className="documento" aria-label="Recorte de ofício com dados borrados">
                <strong>
                  Ofício nº <span className="borrado">000/0000</span>
                </strong>
                <p className="mb-0">
                  Comunicamos o DEFERIMENTO do pedido de repactuação, com efeitos a partir de <span className="borrado">00/00/0000</span>…
                </p>
              </div>
            </li>
          </ul>

          <div className="fatos" aria-label="Fatos públicos">
            <div>
              <strong>{SITE.levantamentoLimpeza.empresas} empresas têm contratos de limpeza vigentes no PNCP</strong>
              <small>
                Fonte: levantamento Equapar no PNCP, {SITE.levantamentoLimpeza.data}. <Link href="/metodo/levantamento-limpeza">Veja o método</Link>.
              </small>
            </div>
            <div>
              {/* C1 (MINUTA até o advogado aprovar) */}
              <strong>Vai prorrogar o contrato? Confira se há repactuação a solicitar e se cabe ressalva no termo aditivo.</strong>
              <small>
                Fonte:{" "}
                <a href={FONTES.preclusao.url} target="_blank" rel="noreferrer">
                  TCU
                </a>
                . <Link href="/guias/prorrogacao-sem-perder-a-repactuacao">A regra depende do regime do contrato e da fase do pedido</Link>.
              </small>
            </div>
            <div>
              <strong>O órgão deve responder preferencialmente em 1 mês</strong>
              <small>
                Fonte:{" "}
                <a href={FONTES.resposta.url} target="_blank" rel="noreferrer">
                  Lei 14.133, art. 92, § 6º
                </a>
                .
              </small>
            </div>
          </div>
        </div>
      </Revelar>

      {/* 3. Como funciona */}
      <Revelar className="secao" id="como-funciona">
        <div className="site-largura">
          <h2 className="titulo-secao">Do contrato ao dinheiro na conta</h2>
          <p className="secundario leitura secao-intro">Diferente da planilha, não esquece o prazo. Diferente da consultoria, cobre a carteira inteira, todo mês.</p>
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
        </div>
      </Revelar>

      {/* 4. O produto: uma prévia por etapa, sem repetir a da abertura; o aviso de exemplo aparece uma vez */}
      <Revelar className="secao secao-faixa">
        <div className="site-largura">
          <h2 className="titulo-secao">O que você vê na Equapar</h2>
          <p className="secundario leitura secao-intro">Recortes das telas do produto. Exemplo ilustrativo, com dados de uma empresa fictícia; os números da demonstração podem ser outros.</p>
          <div className="previas previas-sem-legenda">
            <div className="previa previa-carteira">
              <h3>Carteira e prazos</h3>
              <PreviaCarteira />
            </div>
            <div className="previa">
              <h3>Memória de cálculo, linha a linha</h3>
              <PreviaMemoria />
            </div>
            <div className="previa">
              <h3>Pedido pronto para protocolar</h3>
              <PreviaPronto />
            </div>
            <div className="previa previa-receber">
              <h3>Do deferimento ao recebimento</h3>
              <PreviaReceber />
            </div>
          </div>
          <div className="mt-32">
            <a href="/demonstracao" className="btn btn-primario">
              Ver a demonstração
            </a>
          </div>
        </div>
      </Revelar>

      {/* 5. Planos, com a comparação de alternativas */}
      <Revelar className="secao" id="precos">
        <div className="site-largura">
          <h2 className="titulo-secao">Preço na página, sem &ldquo;fale com vendas&rdquo;</h2>
          <TabelaPlanos />
          <p className="mt-16">
            <Link href="/precos" className="link-seta">
              Calculadora e comparação completa dos planos
            </Link>
          </p>

          <h3 className="mt-32">Três jeitos de cuidar da repactuação</h3>
          <div className="tabela-rolagem so-desktop" tabIndex={0} role="region" aria-label="Comparação: planilha, consultoria e Equapar">
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
          {/* celular: um cartão por critério, com a Equapar primeiro (a tabela escondia justamente essa coluna) */}
          <div className="cartoes-celular">
            {COMPARACAO.map(([criterio, planilha, consultoria, equapar]) => (
              <div key={criterio} className="cartao-linha">
                <strong>{criterio}</strong>
                <span style={{ display: "block", color: "var(--verde)", fontWeight: 500 }}>Equapar: {equapar}</span>
                <span className="legenda" style={{ display: "block" }}>
                  Planilha: {planilha} · Consultoria: {consultoria}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Revelar>

      {/* 6. Perguntas e chamada final */}
      <Revelar className="secao secao-perguntas">
        <div className="site-largura">
          <div className="faq">
            <h2 className="titulo-secao">Perguntas frequentes</h2>
            {PERGUNTAS().map(([p, r]) => (
              <details key={p}>
                <summary>{p}</summary>
                <p>{r}</p>
              </details>
            ))}
          </div>
          <QuemFaz />
          <div className="chamada-final">
            <h2 className="titulo-secao">Seus contratos já estão no PNCP. Veja os prazos agora.</h2>
            <FormCnpjServidor id="cnpj-final" />
            <p className="legenda abertura-legenda mb-0">Grátis, sem senha e sem cadastro.</p>
          </div>
        </div>
      </Revelar>
    </>
  );
}

/** B1: bloco "quem faz". Sem SITE_FUNDADOR_NOME, fala só da empresa; sem SITE_FUNDADOR_FOTO, sem foto. */
function QuemFaz() {
  const e = dadosEmpresa();
  const comFoto = !!(e.fundadorNome && e.fundadorFoto);
  return (
    <figure className={comFoto ? "fundador" : "fundador fundador-sem-foto"}>
      {comFoto && <img src={e.fundadorFoto!} alt={`Foto de ${e.fundadorNome}`} width={96} height={96} style={{ borderRadius: 6, objectFit: "cover" }} />}
      <blockquote>
        <p>
          {e.fundadorNome
            ? `Sou ${e.fundadorNome}. Criei a Equapar depois de ver empresas de limpeza perderem repactuações por prazo e por conta mal documentada. Respondo pessoalmente as mensagens dos primeiros clientes.`
            : "A Equapar nasceu de ver empresas de limpeza perderem repactuações por prazo e por conta mal documentada. As mensagens são respondidas por quem constrói o sistema."}
        </p>
      </blockquote>
    </figure>
  );
}
