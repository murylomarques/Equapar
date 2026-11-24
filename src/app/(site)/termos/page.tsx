import { identificacaoEmpresa } from "@/lib/site";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Termos de uso | Equapar",
  descricao: "O que a Equapar faz e não faz, responsabilidade pelos números da memória de cálculo, resultado, planos e cancelamento.",
  caminho: "/termos",
});

export default function Termos() {
  const empresa = identificacaoEmpresa();
  return (
    <article className="site-largura secao guia documento-legal">
      <h1 className="titulo-landing">Termos de uso</h1>
      <p className="aviso-caixa minuta" role="note">
        <span className="minuta-selo">Minuta</span> Este texto está em revisão jurídica e pode mudar antes da versão final.
      </p>
      <h2>Quem presta o serviço</h2>
      <p>
        {empresa.texto}. Contato: <a href={`mailto:${empresa.canal}`}>{empresa.canal}</a>.
      </p>
      <h2>O que a Equapar faz</h2>
      <p>
        A Equapar é software e apoio operacional: organização de documentos e prazos, consolidação de dados e geração de memória de cálculo e arquivos editáveis para conferência e protocolo pelo cliente. Ela não é escritório de advocacia nem de contabilidade e não protocola pedidos em nome do cliente. Análise jurídica individual, estratégia de recurso e consultoria jurídica são atividades de advogado habilitado e não fazem parte do serviço.
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
