import type { Metadata } from "next";
import { TabelaPlanos } from "@/components/planos";
import { CalculadoraPreco } from "@/components/calculadora-preco";
import { Contato } from "@/components/contato";
import { revisaoEspecialistaAtiva } from "@/lib/revisao";
import { modoPiloto } from "@/lib/chaves";

export const metadata: Metadata = {
  title: "Preços | Equapar",
  description: "Raio-X grátis, piloto por pedido e carteira por posto. Preço na página.",
};

export default function Precos() {
  return (
    <div className="site-largura secao">
      <h1 className="titulo-landing" style={{ fontSize: 40 }}>
        Preço na página, sem &ldquo;fale com vendas&rdquo;
      </h1>
      <p className="secundario leitura">Comece pelo Raio-X grátis. O piloto resolve um pedido real; a carteira cobre todos os contratos, todo mês.</p>
      <div className="mt-24">
        <TabelaPlanos />
      </div>
      <div className="precos-detalhe mt-32">
        <CalculadoraPreco />
        <div className="cartao">
        <h2>Bom saber antes de escolher</h2>
        <ul className="pilha-8" style={{ paddingLeft: 20 }}>
          <li>
            <strong>Quais postos contam:</strong> os dos contratos ativos com mão de obra dedicada. O valor é recalculado a cada renovação.
          </li>
          <li>
            <strong>O que o Piloto não inclui:</strong> análise jurídica individual, estratégia de recurso e consultoria jurídica são atividades de advogado habilitado. A Equapar organiza, calcula e gera os
            arquivos; você confere e protocola.
          </li>
          {!modoPiloto() && (
            <li>
              <strong>Assessoria:</strong> vários clientes numa conta, visão de todos os prazos e PDFs com a sua marca.
            </li>
          )}
          {revisaoEspecialistaAtiva() && (
            <li>
              <strong>Revisão de especialista:</strong> cobrada à parte, para casos complexos.
            </li>
          )}
          <li>
            <strong>Cancelamento:</strong> na tela de cobrança, quando quiser. O acesso pago vale até o fim do período e os dados ficam disponíveis para exportar.
          </li>
        </ul>
        <p className="mb-8">Dúvidas sobre o piloto ou sobre o seu caso?</p>
        <Contato />
        </div>
      </div>
    </div>
  );
}
