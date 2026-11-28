import Link from "next/link";
import { canaisDeAviso } from "@/lib/site";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { PRECOS } from "@/lib/planos";
import { precoJornada40 } from "@/lib/precos";
import { Contato } from "./contato";
import { modoPiloto } from "@/lib/chaves";
import { jornadaLiberada } from "@/lib/chaves";

/** Valor em reais sem centavos, no formato da página ("1.500"). Os números vêm sempre de lib/planos.ts. */
const r$ = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/**
 * Cartões dos planos: para quem é, preço e unidade de cobrança, 2 ou 3 pontos decisivos e a ação no pé.
 * `exemploCarteira`: a linha "N postos = R$ X" some onde a calculadora já mostra a conta (página de preços).
 * `comparar`: tabela completa dentro de um <details>, para quem quer o detalhe.
 */
export function TabelaPlanos({ exemploCarteira = true, comparar = false }: { exemploCarteira?: boolean; comparar?: boolean }) {
  const min = PRECOS.carteiraMinimo;
  const porPosto = PRECOS.carteiraPorPosto;
  const limite = Math.ceil(min / porPosto); // a partir de quantos postos passa do mínimo
  const assessoria = !modoPiloto();
  return (
    <>
      <div className="planos">
        <div className="plano">
          <h3 className="mb-0">Raio-X</h3>
          <p className="plano-para">Para ver os contratos e os prazos antes de tudo.</p>
          <div className="preco">Grátis</div>
          <small className="plano-unidade">sem cadastro</small>
          <ul>
            <li>Contratos vigentes no PNCP pelo CNPJ</li>
            <li>Fim da vigência e prazo de cada um</li>
            {/* hífen inseparável (U+2011): "e-mail" não quebra no hífen */}
            <li>Relatório em PDF por e‑mail</li>
          </ul>
          <div>
            <Link href="/raio-x" className="btn">
              Fazer o Raio-X
            </Link>
          </div>
        </div>
        <div className="plano">
          <h3 className="mb-0">Piloto</h3>
          <p className="plano-para">Para resolver um pedido real agora.</p>
          <div className="preco">
            <span style={{ whiteSpace: "nowrap" }}>{r$(PRECOS.pilotoPorPedido)}</span>
          </div>
          <small className="plano-unidade">pelo 1º pedido, até {PRECOS.pilotoPostosIncluidos} postos</small>
          {/* C3: os mesmos termos do texto aprovado, em três pontos como nos outros planos */}
          <ul>
            <li>Organização de documentos e prazos</li>
            <li>Consolidação dos dados e geração da memória de cálculo e dos arquivos editáveis</li>
            <li>Conferência e protocolo feitos por você</li>
          </ul>
          <p className="legenda mb-0">
            Assine o anual em até {PRECOS.pilotoAbatimentoDias} dias e os {r$(PRECOS.pilotoPorPedido)} viram desconto.
          </p>
          <div>
            <Contato agenda={false} />
          </div>
        </div>
        <div className="plano plano-destaque">
          <div className="entre">
            <h3 className="mb-0">Carteira</h3>
            <span className="selo selo-verde">Preço de fundador</span>
          </div>
          <p className="plano-para">Para manter todos os contratos no prazo, todo mês.</p>
          <div className="preco">
            {r$(porPosto)} <span className="preco-de">por posto</span>
          </div>
          <small className="plano-unidade">por mês, mínimo {r$(min)}</small>
          <ul>
            <li>{canaisDeAviso()} de cada contrato</li>
            <li>Pedidos montados pelo sistema</li>
            <li>Acompanhamento até receber</li>
          </ul>
          {exemploCarteira && (
            <p className="legenda mb-0">
              Exemplo: {limite - 1} postos = {r$(min)} (mínimo); {limite} postos = {r$(limite * porPosto)}.
            </p>
          )}
          <p className="legenda mb-0">
            <strong>Anual:</strong> 12 meses pelo preço de {PRECOS.mesesPagosNoAnual()}
            {jornadaLiberada() ? ", com a Jornada 40 horas incluída" : ""}.
          </p>
          {revisaoEspecialistaAtiva() && <p className="legenda mb-0">Revisão de especialista é cobrada à parte.</p>}
          <div>
            <Link href="/criar-conta" className="btn btn-primario">
              Criar conta
            </Link>
          </div>
        </div>
        {/* D0: o pacote da jornada só aparece com a jornada liberada */}
        {jornadaLiberada() && (
          <div className="plano">
            <h3 className="mb-0">Jornada 40 horas</h3>
            <p className="plano-para">Para recalcular os contratos com a nova jornada.</p>
            <div className="preco">{r$(precoJornada40(1)!)}</div>
            <small className="plano-unidade">
              por contrato até {PRECOS.jornada40Faixas[0].ate} postos; {r$(PRECOS.jornada40Faixas[1].valor)} até {PRECOS.jornada40Faixas[1].ate} postos
            </small>
            <p className="secundario mb-0 plano-texto">Pedido de reequilíbrio pela EC 141/2026, com os dois cenários (manter ou reduzir as horas) lado a lado.</p>
            <p className="legenda mb-0">Incluída no anual da Carteira. Acima de {PRECOS.jornada40Faixas[1].ate} postos, sob consulta.</p>
            <div>
              <Contato agenda={false} />
            </div>
          </div>
        )}
        {assessoria && (
          <div className="plano">
            <h3 className="mb-0">Assessoria</h3>
            <p className="plano-para">Para quem cuida da repactuação de vários clientes.</p>
            <div className="preco">
              <span style={{ whiteSpace: "nowrap" }}>{r$(PRECOS.assessoria)}</span>
            </div>
            <small className="plano-unidade">
              por mês, até {PRECOS.assessoriaClientes()} clientes e {PRECOS.assessoriaPostosIncluidos.toLocaleString("pt-BR")} postos; {r$(PRECOS.assessoriaPorPostoExtra)} por posto acima
            </small>
            <ul>
              <li>Vários clientes numa conta</li>
              <li>A sua marca nos PDFs</li>
            </ul>
            <div>
              <Link href="/assessorias" className="btn">
                Ver o plano
              </Link>
            </div>
          </div>
        )}
      </div>
      <p className="legenda mt-16 mb-0">
        Preço de fundador: os {PRECOS.fundadorClientes} primeiros clientes mantêm este preço por {PRECOS.fundadorMeses} meses. Garantia de {PRECOS.garantiaDias} dias: se desistir
        no primeiro mês, devolvemos o valor pago na 1ª assinatura (a garantia não cobre o resultado do pedido no órgão). No anual, cancele quando quiser, sem multa: descontamos os
        meses já iniciados pelo preço do plano mensal e devolvemos o restante.
      </p>

      {comparar && (
        <details className="comparar-planos mt-24">
          <summary>Comparar os planos</summary>
          <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Comparação dos planos">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Item</span>
                  </th>
                  <th scope="col">Raio-X</th>
                  <th scope="col">Piloto</th>
                  <th scope="col">Carteira</th>
                  {assessoria && <th scope="col">Assessoria</th>}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Alcance", "Consulta pontual", "Um pedido real", "Todos os contratos, todo mês", "Todos os contratos de vários clientes"],
                  ["Como se paga", "Grátis, sem cadastro", `${r$(PRECOS.pilotoPorPedido)} pelo 1º pedido (até ${PRECOS.pilotoPostosIncluidos} postos)`, `${r$(porPosto)} por posto ao mês, mínimo ${r$(min)}`, `${r$(PRECOS.assessoria)} por mês até ${PRECOS.assessoriaPostosIncluidos.toLocaleString("pt-BR")} postos; ${r$(PRECOS.assessoriaPorPostoExtra)} por posto acima`],
                  ["Contratos e prazos do PNCP pelo CNPJ", "Sim", "Sim", "Sim", "Sim"],
                  ["Memória de cálculo e arquivos editáveis", "Não", "Sim", "Sim", "Sim"],
                  ["Vários clientes e a sua marca nos PDFs", "Não", "Não", "Não", "Sim"],
                  ["Quem confere e protocola", "Você", "Você", "Você", "Você"],
                ].map(([item, ...valores]) => (
                  <tr key={item}>
                    <th scope="row">{item}</th>
                    {valores.slice(0, assessoria ? 4 : 3).map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
