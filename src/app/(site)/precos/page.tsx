import type { Metadata } from "next";
import { TabelaPlanos } from "@/components/planos";

export const metadata: Metadata = {
  title: "Preços | Equapar",
  description: "Raio-X grátis, piloto por pedido, carteira por posto e plano para assessorias. Preço na página.",
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
      <div className="cartao mt-24 leitura">
        <h2>O que cada plano inclui</h2>
        <ul className="pilha-8" style={{ paddingLeft: 20 }}>
          <li>
            <strong>Raio-X:</strong> contratos vigentes do PNCP pelo CNPJ, prazos e relatório em PDF.
          </li>
          <li>
            <strong>Piloto:</strong> uma repactuação real, com memória de cálculo revisada e acompanhamento até a cobrança. A assinatura da carteira pode começar no próprio piloto.
          </li>
          <li>
            <strong>Carteira:</strong> R$ 4 por posto de trabalho por mês, mínimo de R$ 297. Avisos por e-mail e WhatsApp, pedidos montados pelo sistema e painel A receber.
          </li>
          <li>
            <strong>Assessoria:</strong> vários clientes numa conta, visão de todos os prazos e PDFs com a sua marca.
          </li>
          <li>
            <strong>Revisão de especialista:</strong> cobrada à parte, para casos complexos.
          </li>
        </ul>
        <p className="legenda mb-0">Cancele quando quiser, na tela de cobrança. Seus dados ficam disponíveis para exportar.</p>
      </div>
    </div>
  );
}
