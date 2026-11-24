import { TabelaPlanos } from "@/components/planos";
import { CalculadoraPreco } from "@/components/calculadora-preco";
import { Contato } from "@/components/contato";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { modoPiloto } from "@/lib/chaves";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Preços: repactuação de contratos públicos | Equapar",
  descricao: "Raio-X grátis dos prazos pelo CNPJ, Piloto por pedido e Carteira por posto ao mês. Calcule o valor da sua empresa e compare os planos.",
  caminho: "/precos",
});

export default function Precos() {
  return (
    <div className="site-largura secao">
      <h1 className="titulo-landing">Preço na página, sem &ldquo;fale com vendas&rdquo;</h1>
      <p className="secundario leitura">Comece pelo Raio-X grátis. O Piloto resolve um pedido real; a Carteira cobre todos os contratos, todo mês.</p>
      <h2 className="sr-only">Planos</h2>
      <div className="mt-24">
        <TabelaPlanos exemploCarteira={false} comparar />
      </div>
      <div className="precos-detalhe mt-32">
        <CalculadoraPreco />
        <div className="cartao">
          <h2>Bom saber antes de escolher</h2>
          <ul className="pilha-8" style={{ paddingLeft: 20 }}>
            <li>
              <strong>Quais postos contam:</strong> os dos contratos ativos com mão de obra dedicada, recalculados a cada renovação.
            </li>
            <li>
              <strong>O que fica de fora:</strong> análise jurídica individual, estratégia de recurso e consultoria jurídica, que são atividades de advogado habilitado. Você confere e protocola.
            </li>
            {!modoPiloto() && (
              <li>
                <strong>Assessoria:</strong> vários clientes numa conta, com a sua marca nos PDFs.
              </li>
            )}
            {revisaoEspecialistaAtiva() && (
              <li>
                <strong>Revisão de especialista:</strong> cobrada à parte, para casos complexos.
              </li>
            )}
            <li>
              <strong>Cancelamento:</strong> na tela de cobrança, quando quiser. O período pago vale até o fim e os dados ficam para exportar.
            </li>
          </ul>
          <p className="mb-8">Dúvidas sobre o piloto ou sobre o seu caso?</p>
          <Contato />
        </div>
      </div>
    </div>
  );
}
