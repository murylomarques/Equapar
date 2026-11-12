import type { Metadata } from "next";
import Link from "next/link";
import { PreviaPronto } from "@/components/previas";

export const metadata: Metadata = {
  title: "Para assessorias | Equapar",
  description: "Todos os prazos e pedidos dos seus clientes numa tela, com a sua marca nos PDFs.",
};

export default function Assessorias() {
  return (
    <div className="site-largura secao">
      <div className="grade-2" style={{ alignItems: "center" }}>
        <div>
          <p className="sobretitulo">Para assessorias de licitação, contadores e advogados</p>
          <h1 className="titulo-landing" style={{ fontSize: 40 }}>
            Cuida da repactuação de vários clientes?
          </h1>
          <p className="secundario leitura">
            Uma tela com todos os prazos, os pedidos de cada cliente e os PDFs com a sua marca. A Equapar é a sua ferramenta: você revisa, assina e cobra pelo serviço.
          </p>
          <ul className="pilha-8" style={{ paddingLeft: 20 }}>
            <li>Seletor de cliente no topo e a visão &ldquo;Todos os clientes&rdquo;, com prazos em 60 dias, pedidos abertos e valores a receber.</li>
            <li>Ofício, planilha e memória de cálculo com o nome e a cor da sua assessoria.</li>
            <li>Papéis por pessoa: dono, gerente de contratos, contador e leitura.</li>
          </ul>
          <p>
            <strong>A partir de R$ 1.497 por mês.</strong>
          </p>
          <Link href="/criar-conta?tipo=assessoria" className="btn btn-primario">
            Criar conta de assessoria
          </Link>
        </div>
        <PreviaPronto />
      </div>
    </div>
  );
}
