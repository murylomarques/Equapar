/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { FormCnpj } from "@/components/form-cnpj";
import { PreviaCarteira, PreviaHoje, PreviaMemoria, PreviaPronto, PreviaReceber } from "@/components/previas";
import { Revelar } from "@/components/revelar";
import { SITE, dadoSite } from "@/lib/site";
import { TabelaPlanos } from "@/components/planos";
import { FONTES } from "@/lib/prazos";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";

export default function Landing() {
  return (
    <>
      {/* 2. Abertura */}
      <div className="site-largura">
        <section className="abertura" aria-labelledby="titulo-abertura">
          <div>
            <p className="sobretitulo">Para empresas de limpeza e conservação com contratos públicos</p>
            <h1 id="titulo-abertura" className="titulo-landing">
              A convenção subiu. O seu contrato com o governo também pode subir.
            </h1>
            <p className="leitura" style={{ fontSize: 18, color: "var(--grafite)" }}>
              A Equapar acompanha os contratos públicos da sua empresa, avisa antes da prorrogação e monta o pedido de repactuação com memória de cálculo e documentos. Depois, segue a diferença até ela entrar no caixa.
            </p>
            <div className="mt-24">
              <FormCnpj id="cnpj-abertura" />
              <p className="legenda" style={{ marginTop: 10 }}>
                Grátis. Usa só dados públicos do PNCP. Sem senha e sem cadastro.
              </p>
              <a href="/demonstracao">Ver a tela por dentro (2 min)</a>
            </div>
          </div>
          <PreviaHoje />
        </section>

        {/* 3. Faixa de fatos */}
        <section aria-label="Fatos públicos" className="fatos">
          <div>
            <strong>{SITE.levantamentoLimpeza.empresas} empresas têm contratos de limpeza vigentes no PNCP</strong>
            <small>Fonte: levantamento Equapar no PNCP, {SITE.levantamentoLimpeza.data}.</small>
          </div>
          <div>
            <strong>Assinar a prorrogação sem pedir pode encerrar o direito à repactuação</strong>
            <small>
              Fonte:{" "}
              <a href={FONTES.preclusao.url} target="_blank" rel="noreferrer">
                TCU
              </a>
              .
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
        </section>
      </div>

      {/* 4. O problema */}
      <Revelar className="secao">
        <div className="site-largura">
          <h2 className="titulo-secao">Onde o dinheiro fica na mesa</h2>
          <div className="problemas">
            <div className="problema">
              <div>
                <h3>A convenção subiu em janeiro. O pedido não saiu.</h3>
                <p className="secundario">O piso aumentou, a folha aumentou, e o contrato continua pagando o valor antigo.</p>
              </div>
              <div className="documento" aria-label="Recorte de planilha de custos com dados borrados">
                <div className="entre">
                  <strong>Planilha de custos · Módulo 1</strong>
                  <span className="borrado">Contrato 00/0000</span>
                </div>
                <div className="entre">
                  <span>Salário base (piso da categoria)</span>
                  <span className="num borrado">R$ 0.000,00</span>
                </div>
                <div className="entre">
                  <span>Adicional de insalubridade</span>
                  <span className="num borrado">R$ 000,00</span>
                </div>
              </div>
            </div>
            <div className="problema">
              <div>
                <h3>A prorrogação foi assinada sem ressalva.</h3>
                <p className="secundario">Para o TCU, quem prorroga sem pedir a repactuação aceita as condições antigas.</p>
              </div>
              <div className="documento" aria-label="Recorte de termo aditivo com dados borrados">
                <strong>Termo aditivo de prorrogação</strong>
                <p className="mb-0">
                  Fica prorrogado o prazo de vigência do contrato nº <span className="borrado">00/0000</span> por mais 12 meses, mantidas as demais cláusulas e condições…
                </p>
              </div>
            </div>
            <div className="problema">
              <div>
                <h3>O pedido foi deferido. A diferença nunca foi cobrada.</h3>
                <p className="secundario">Sem apostilamento e sem fatura da diferença, o dinheiro não entra.</p>
              </div>
              <div className="documento" aria-label="Recorte de ofício com dados borrados">
                <strong>Ofício nº <span className="borrado">000/0000</span></strong>
                <p className="mb-0">
                  Comunicamos o DEFERIMENTO do pedido de repactuação, com efeitos a partir de <span className="borrado">00/00/0000</span>. Providencie a nota fiscal das diferenças…
                </p>
              </div>
            </div>
          </div>
        </div>
      </Revelar>

      {/* 5. Como funciona */}
      <Revelar className="secao" id="como-funciona">
        <div className="site-largura">
          <h2 className="titulo-secao">Do CNPJ ao dinheiro, em quatro passos</h2>
          <ol className="passos lista-limpa">
            <li className="passo">
              <div>
                <div className="passo-num">1</div>
                <h3>Conecte o CNPJ.</h3>
                <p className="secundario">Os contratos publicados no PNCP aparecem sozinhos. Você confirma a convenção de cada um.</p>
              </div>
              <PreviaCarteira />
            </li>
            <li className="passo">
              <div>
                <div className="passo-num">2</div>
                <h3>Receba os prazos.</h3>
                <p className="secundario">Avisos aos 60, 30 e 7 dias, por e-mail e WhatsApp, com o que fazer em cada caso.</p>
              </div>
              <PreviaHoje />
            </li>
            <li className="passo">
              <div>
                <div className="passo-num">3</div>
                <h3>Monte o pedido.</h3>
                <p className="secundario">Envie a planilha da proposta. A Equapar calcula, mostra de onde saiu cada número e gera ofício, planilha e memória.</p>
              </div>
              <PreviaMemoria />
            </li>
            <li className="passo">
              <div>
                <div className="passo-num">4</div>
                <h3>Siga até receber.</h3>
                <p className="secundario">Protocolo, resposta, apostilamento e fatura da diferença. Nada sai da lista antes de o dinheiro entrar.</p>
              </div>
              <PreviaReceber />
            </li>
          </ol>
        </div>
      </Revelar>

      {/* 6. Raio-X, de novo */}
      <Revelar className="secao secao-escura">
        <div className="site-largura" style={{ maxWidth: 760 }}>
          <h2 className="titulo-secao">Comece pelo que já é público.</h2>
          <p style={{ color: "#cfccc4" }}>Digite o CNPJ e veja os contratos vigentes da sua empresa e quando cada um termina.</p>
          <div className="raiox-escuro">
            <FormCnpj id="cnpj-meio" escuro />
          </div>
        </div>
      </Revelar>

      {/* 7. Comparação */}
      <Revelar className="secao">
        <div className="site-largura">
          <h2 className="titulo-secao">Três jeitos de cuidar da repactuação</h2>
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
                <tr>
                  <th scope="row">Avisa antes da prorrogação</th>
                  <td>Se alguém lembrar</td>
                  <td>Se contratada para isso</td>
                  <td>Sempre, por contrato</td>
                </tr>
                <tr>
                  <th scope="row">Mostra de onde saiu cada número</th>
                  <td>Depende de quem fez</td>
                  <td>Sim</td>
                  <td>Sim, linha a linha</td>
                </tr>
                <tr>
                  <th scope="row">Acompanha até receber</th>
                  <td>Depende da equipe</td>
                  <td>Depende do escopo</td>
                  <td>Sim</td>
                </tr>
                <tr>
                  <th scope="row">Como se paga</th>
                  <td>Horas da equipe</td>
                  <td>Por pedido</td>
                  <td>Por mês, por posto</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Revelar>

      {/* 8. Preços */}
      <Revelar className="secao" id="precos">
        <div className="site-largura">
          <h2 className="titulo-secao">Preço na página, sem &ldquo;fale com vendas&rdquo;</h2>
          <TabelaPlanos />
        </div>
      </Revelar>

      {/* 9. Para assessorias */}
      <Revelar className="secao">
        <div className="site-largura grade-2" style={{ alignItems: "center" }}>
          <div>
            <h2 className="titulo-secao">Cuida da repactuação de vários clientes?</h2>
            <p className="secundario leitura">Uma tela com todos os prazos, os pedidos de cada cliente e os PDFs com a sua marca.</p>
            <Link href="/assessorias" className="btn">
              Conhecer o plano para assessorias
            </Link>
          </div>
          <PreviaPronto />
        </div>
      </Revelar>

      {/* 10. Quem faz (5.2: sem o nome do fundador preenchido, a seção não aparece em produção) */}
      {dadoSite(SITE.fundador.nome) && (
      <Revelar className="secao">
        <div className="site-largura">
          <div className="fundador">
            {SITE.fundador.foto ? (
              <img src={SITE.fundador.foto} alt={`Foto de ${SITE.fundador.nome}`} width={160} height={160} style={{ borderRadius: 6, objectFit: "cover" }} />
            ) : (
              <div className="foto-vaga">Espaço para a foto real do fundador (configure em src/lib/site.ts)</div>
            )}
            <blockquote style={{ margin: 0 }}>
              <p style={{ fontFamily: "var(--fonte-serif)", fontSize: 24, lineHeight: 1.3 }}>
                Sou {SITE.fundador.nome}, desenvolvedor. Criei a Equapar depois de ver empresas de limpeza perderem repactuações por prazo e por conta mal documentada. Respondo pessoalmente as mensagens do piloto.
              </p>
            </blockquote>
          </div>
        </div>
      </Revelar>
      )}

      {/* 11. Perguntas */}
      <Revelar className="secao">
        <div className="site-largura faq" style={{ maxWidth: 860 }}>
          <h2 className="titulo-secao">Perguntas</h2>
          {[
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
              "Contratos assinados antes da LC 214/2025, ou com proposta anterior a ela, podem ter direito ao reequilíbrio previsto na lei. A Equapar marca quais são.",
            ],
            ["Como cancelo?", "Na tela de cobrança, a qualquer momento. Seus dados ficam disponíveis para exportar."],
          ].map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </Revelar>

      {/* 12. Chamada final */}
      <Revelar className="secao">
        <div className="site-largura" style={{ maxWidth: 760 }}>
          <h2 className="titulo-secao">Seus contratos já estão no PNCP. Veja os prazos agora.</h2>
          <FormCnpj id="cnpj-final" />
        </div>
      </Revelar>
    </>
  );
}
