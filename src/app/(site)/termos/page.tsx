import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso | Equapar" };

export default function Termos() {
  return (
    <article className="site-largura secao guia">
      <h1>Termos de uso</h1>
      <p className="aviso-caixa">Minuta. Revise com um profissional antes de publicar.</p>
      <h2>O que a Equapar faz</h2>
      <p>
        A Equapar é um software que organiza prazos, cálculos e documentos de repactuação de contratos públicos. Ela não é escritório de advocacia nem de contabilidade e não protocola pedidos em nome do cliente.
      </p>
      <h2>Responsabilidade pelos números</h2>
      <p>
        O motor de cálculo aplica a estrutura da planilha de custos aos números informados pelo cliente. O cliente confere e aprova a memória de cálculo; recomendamos a revisão por profissional habilitado antes do protocolo.
      </p>
      <h2>Resultado</h2>
      <p>Aprovação e pagamento dependem do órgão contratante. A Equapar não garante deferimento nem recebimento.</p>
      <h2>Planos e cancelamento</h2>
      <p>Os preços estão na página de preços. O cliente cancela quando quiser, na tela de cobrança, e pode exportar seus dados.</p>
    </article>
  );
}
