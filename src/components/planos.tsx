import Link from "next/link";

export function TabelaPlanos() {
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
          <p className="secundario mb-0">Uma repactuação real, da coleta de documentos ao acompanhamento da cobrança.</p>
          <Link href="/criar-conta" className="btn mt-16">
            Começar um piloto
          </Link>
        </div>
        <div className="plano plano-destaque">
          <h3 className="mb-0">Carteira</h3>
          <div className="preco">R$ 4 por posto</div>
          <small>por mês, mínimo R$ 297</small>
          <p className="secundario mb-0">Avisos, pedidos montados pelo sistema, acompanhamento e WhatsApp.</p>
          <p className="legenda mb-0">Exemplo: 375 postos dão R$ 1.500 por mês. Revisão de especialista é cobrada à parte.</p>
          <Link href="/criar-conta" className="btn btn-primario mt-16">
            Criar conta
          </Link>
        </div>
        <div className="plano">
          <h3 className="mb-0">Assessoria</h3>
          <div className="preco">a partir de R$ 1.497</div>
          <small>por mês</small>
          <p className="secundario mb-0">Vários clientes numa conta, com a sua marca nos PDFs.</p>
          <Link href="/assessorias" className="btn mt-16">
            Ver o plano
          </Link>
        </div>
      </div>
      <p className="legenda mt-16">Preços em teste. A página mostra sempre o preço que estiver valendo.</p>
    </>
  );
}
