import Link from "next/link";
import { canaisDeAviso } from "@/lib/site";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { PRECOS } from "@/lib/planos";
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
            <li>Relatório em PDF por e-mail</li>
          </ul>
          <Link href="/raio-x" className="btn">
            Fazer o Raio-X
          </Link>
        </div>
        <div className="plano">
          <h3 className="mb-0">Piloto</h3>
          <p className="plano-para">Para resolver um pedido real agora.</p>
          <div className="preco">
            <span className="preco-de">a partir de</span> <span style={{ whiteSpace: "nowrap" }}>{r$(PRECOS.pilotoPorPedido)}</span>
          </div>
          <small className="plano-unidade">por pedido</small>
          {/* C3 */}
          <p className="secundario mb-0 plano-texto">
            Organização de documentos e prazos, consolidação de dados e geração de memória de cálculo e arquivos editáveis para conferência e protocolo pelo cliente.
          </p>
          <div>
            <Contato agenda={false} />
          </div>
        </div>
        <div className="plano plano-destaque">
          <h3 className="mb-0">Carteira</h3>
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
          {revisaoEspecialistaAtiva() && <p className="legenda mb-0">Revisão de especialista é cobrada à parte.</p>}
          <Link href="/criar-conta" className="btn btn-primario">
            Criar conta
          </Link>
        </div>
        {/* D0: o pacote da jornada só aparece com a jornada liberada */}
        {jornadaLiberada() && (
          <div className="plano">
            <h3 className="mb-0">Jornada 40 horas</h3>
            <p className="plano-para">Para recalcular os contratos com a nova jornada.</p>
            <div className="preco">{r$(PRECOS.jornada40PorContrato())}</div>
            <small className="plano-unidade">por contrato, nas duas etapas</small>
            <p className="secundario mb-0 plano-texto">Pedido de reequilíbrio pela EC 141/2026, com os dois cenários (manter ou reduzir as horas) lado a lado.</p>
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
              <span className="preco-de">a partir de</span> <span style={{ whiteSpace: "nowrap" }}>{r$(PRECOS.assessoria)}</span>
            </div>
            <small className="plano-unidade">por mês</small>
            <ul>
              <li>Vários clientes numa conta</li>
              <li>A sua marca nos PDFs</li>
            </ul>
            <Link href="/assessorias" className="btn">
              Ver o plano
            </Link>
          </div>
        )}
      </div>
      <p className="legenda mt-16 mb-0">Preços em teste. A página mostra sempre o preço que estiver valendo.</p>

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
                  ["Como se paga", "Grátis, sem cadastro", `A partir de ${r$(PRECOS.pilotoPorPedido)} por pedido`, `${r$(porPosto)} por posto ao mês, mínimo ${r$(min)}`, `A partir de ${r$(PRECOS.assessoria)} por mês`],
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
