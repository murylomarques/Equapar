import Link from "next/link";
import { canaisDeAviso } from "@/lib/site";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { PRECOS } from "@/lib/planos";
import { Contato } from "./contato";
import { modoPiloto } from "@/lib/chaves";
import { jornadaLiberada } from "@/lib/chaves";

export function TabelaPlanos() {
  const min = PRECOS.carteiraMinimo;
  const porPosto = PRECOS.carteiraPorPosto;
  const limite = Math.ceil(min / porPosto); // a partir de quantos postos passa do mínimo
  return (
    <>
      <div className="planos">
        <div className="plano">
          <h3 className="mb-0">Raio-X</h3>
          <div className="preco">Grátis</div>
          <p className="secundario mb-0">Contratos e prazos do PNCP e relatório em PDF.</p>
          <Link href="/raio-x" className="btn mt-16">
            Fazer o Raio-X
          </Link>
        </div>
        <div className="plano">
          <h3 className="mb-0">Piloto</h3>
          <div className="preco">a partir de R$ 1.500</div>
          <small>por pedido</small>
          {/* C3 */}
          <p className="secundario mb-0">Organização de documentos e prazos, consolidação de dados e geração de memória de cálculo e arquivos editáveis para conferência e protocolo pelo cliente.</p>
          <div className="mt-16">
            <Contato agenda={false} />
          </div>
        </div>
        <div className="plano plano-destaque">
          <h3 className="mb-0">Carteira</h3>
          <div className="preco">R$ 4 por posto</div>
          <small>por mês, mínimo R$ 297</small>
          <p className="secundario mb-0">{canaisDeAviso()}, pedidos montados pelo sistema e acompanhamento.</p>
          <p className="legenda mb-0">
            Exemplo: {limite - 1} postos = R$ {min} (mínimo); {limite} postos = R$ {limite * porPosto}.{revisaoEspecialistaAtiva() ? " Revisão de especialista é cobrada à parte." : ""}
          </p>
          <Link href="/criar-conta" className="btn btn-primario mt-16">
            Criar conta
          </Link>
        </div>
        {/* D0: o pacote da jornada só aparece com a jornada liberada */}
        {jornadaLiberada() && (
          <div className="plano">
            <h3 className="mb-0">Jornada 40 horas</h3>
            <div className="preco">R$ {PRECOS.jornada40PorContrato().toLocaleString("pt-BR")}</div>
            <small>por contrato, nas duas etapas</small>
            <p className="secundario mb-0">Pedido de reequilíbrio pela EC 141/2026, com os dois cenários (manter ou reduzir as horas) lado a lado.</p>
            <div className="mt-16">
              <Contato agenda={false} />
            </div>
          </div>
        )}
        {!modoPiloto() && (
        <div className="plano">
          <h3 className="mb-0">Assessoria</h3>
          <div className="preco">a partir de R$ 1.497</div>
          <small>por mês</small>
          <p className="secundario mb-0">Vários clientes numa conta, com a sua marca nos PDFs.</p>
          <Link href="/assessorias" className="btn mt-16">
            Ver o plano
          </Link>
        </div>
        )}
      </div>
      <p className="legenda mt-16">Preços em teste. A página mostra sempre o preço que estiver valendo.</p>
    </>
  );
}
