import { identificacaoEmpresa } from "@/lib/site";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Termos de uso | Equapar",
  descricao: "O que a Equapar faz e não faz, responsabilidade pelos números, planos, garantia de 30 dias, cancelamento e devolução, preço de fundador, Piloto e plano Assessoria.",
  caminho: "/termos",
});

/*
 * Texto das seções "Condições comerciais" e "Plano Assessoria": parecer do advogado de 28/11/2026 (B2 e B3), transcrito.
 * Única adaptação: o item 4 (anual), pela opção do dono de descontar os meses iniciados pelo preço do plano mensal
 * (lib/reembolso.ts). Mudou o texto? Troque TERMOS_VERSAO em lib/termos.ts.
 */
export default function Termos() {
  const empresa = identificacaoEmpresa();
  return (
    <article className="site-largura secao">
      {/* mesma margem esquerda das outras páginas: a coluna de leitura fica dentro da largura do site */}
      <div className="guia documento-legal">
        <h1 className="titulo-landing">Termos de uso</h1>
        <p className="legenda documento-data">Atualizado em 28/11/2026.</p>
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

        <h2>Condições comerciais, pagamento e cancelamento</h2>
        <h3>1. Planos e contratação</h3>
        <p>
          A Equapar disponibiliza planos de assinatura cujos preços, funcionalidades, limites de utilização e condições comerciais são apresentados na página de preços e no momento da contratação.
        </p>
        <p>
          As condições expressamente apresentadas e aceitas pelo contratante integrarão o contrato, permanecendo registradas na versão da oferta vigente no momento da contratação.
        </p>
        <h3>2. Plano anual</h3>
        <p>
          O plano anual possui período contratual de 12 meses, pelo valor equivalente a 10 mensalidades do respectivo plano mensal, podendo ser pago à vista ou parceladamente, conforme as condições apresentadas no momento da contratação.
        </p>
        <p>O parcelamento constitui modalidade de pagamento do plano anual, não alterando sua duração contratual.</p>
        <h3>3. Garantia de satisfação de 30 dias</h3>
        <p>
          O contratante poderá solicitar o cancelamento de sua primeira assinatura no prazo de 30 dias corridos, contados da contratação inicial, com restituição integral dos valores pagos pela respectiva assinatura e cancelamento das cobranças futuras.
        </p>
        <p>
          A garantia aplica-se à satisfação com a plataforma e não representa garantia de deferimento de requerimentos administrativos, reconhecimento de créditos, aprovação de cálculos ou obtenção de resultados perante órgãos públicos.
        </p>
        <p>A garantia comercial não restringe os direitos assegurados pela legislação aplicável, inclusive o direito de arrependimento, quando cabível.</p>
        <h3>4. Cancelamento</h3>
        <p>O contratante poderá solicitar o cancelamento diretamente pela plataforma ou pelos canais oficiais de atendimento da Equapar.</p>
        <p>Após o período da garantia, o cancelamento do plano mensal permitirá a utilização da plataforma até o encerramento do período já pago, sem novas cobranças.</p>
        <p>
          No plano anual, será assegurada a restituição proporcional ao período contratual não utilizado: do valor efetivamente pago, descontam-se os meses já iniciados, cada um pelo preço do plano mensal vigente na contratação, sem multa.
        </p>
        <p>
          Nos pagamentos parcelados, será realizado o ajuste financeiro necessário para que o contratante arque somente com o período utilizado, observados os procedimentos da instituição responsável pelo pagamento.
        </p>
        <p>A solicitação de cancelamento será confirmada por meio eletrônico.</p>
        <h3>5. Renovação</h3>
        <p>A renovação automática, quando expressamente informada e aceita no momento da contratação, poderá ser desativada a qualquer momento.</p>
        <p>A Equapar comunicará previamente alterações de preço aplicáveis aos períodos futuros, respeitando as condições comerciais já contratadas.</p>
        <h3>6. Condição comercial de fundador</h3>
        <p>
          Os 10 primeiros contratantes distintos que efetivarem uma assinatura elegível terão direito à manutenção do preço originalmente contratado pelo período de 24 meses consecutivos, contado da contratação inicial.
        </p>
        <p>O benefício permanecerá condicionado à continuidade da assinatura e à manutenção do plano originalmente contratado.</p>
        <p>
          Serviços adicionais, excedentes de utilização e mudanças voluntárias de plano não estarão abrangidos pelo congelamento de preço, salvo disposição expressa em contrário.
        </p>
        <h3>7. Projeto piloto</h3>
        <p>
          O projeto piloto será disponibilizado pelo valor de R$ 1.500,00, contemplando a utilização da solução para elaboração do primeiro pedido, limitado a 50 postos de trabalho.
        </p>
        <p>
          Caso o contratante adquira um plano anual em até 60 dias corridos, contados da contratação do piloto, o valor efetivamente pago pelo piloto será integralmente convertido em crédito para abatimento do preço do plano anual, limitado ao respectivo valor.
        </p>
        <p>O crédito não será cumulativo, transferível ou convertido em dinheiro.</p>
        <p>O projeto piloto não constitui promessa de aprovação do pedido pela Administração Pública.</p>
        <h3>8. Exportação e encerramento</h3>
        <p>O contratante poderá exportar seus documentos e dados durante a vigência da assinatura.</p>
        <p>Após o encerramento do acesso contratado, será disponibilizado prazo de 30 dias corridos para exportação dos dados, em ambiente restrito, sem novas cobranças.</p>
        <p>
          Encerrado esse prazo, os dados serão eliminados ou anonimizados conforme a Política de Privacidade, ressalvadas as hipóteses de conservação autorizadas pela legislação.
        </p>
        <h3>9. Natureza dos serviços</h3>
        <p>
          A Equapar é uma plataforma tecnológica de apoio à gestão contratual, organização de informações, elaboração de cálculos, documentação e acompanhamento de procedimentos administrativos.
        </p>
        <p>A plataforma não exerce representação judicial, advocacia ou consultoria jurídica privativa de profissionais legalmente habilitados.</p>
        <p>Os documentos e cálculos gerados destinam-se a subsidiar os procedimentos administrativos do contratante e não vinculam a Administração Pública.</p>
        <p>A presente disposição não exclui a responsabilidade da Equapar por falhas na prestação de seus próprios serviços, nos termos da legislação aplicável.</p>

        <h2>Plano Assessoria, gestão de terceiros e personalização de documentos</h2>
        <h3>1. Abrangência</h3>
        <p>O Plano Assessoria destina-se a empresas e profissionais que prestam serviços de gestão administrativa e contratual a terceiros.</p>
        <p>
          O plano possui mensalidade de R$ 1.497,00, contemplando até 20 empresas clientes ativas e até 1.500 postos de trabalho ativos, considerados conjuntamente.
        </p>
        <p>Cada posto ativo excedente será cobrado pelo valor adicional de R$ 1,00 por mês, conforme demonstrativo de utilização disponibilizado ao contratante.</p>
        <p>A inclusão de empresas acima do limite contratado dependerá de ampliação expressamente contratada, não sendo permitida cobrança automática não informada.</p>
        <h3>2. Autorização e tratamento de dados de terceiros</h3>
        <p>A assessoria deverá possuir autorização ou outro fundamento jurídico adequado para cadastrar, acessar, tratar e administrar as informações de seus clientes.</p>
        <p>
          O tratamento de dados pessoais deverá observar a Lei Geral de Proteção de Dados Pessoais, os limites das autorizações recebidas e as finalidades relacionadas aos serviços contratados.
        </p>
        <p>A assessoria deverá manter controle sobre seus usuários autorizados e comunicar à Equapar alterações que impliquem a revogação de acessos.</p>
        <h3>3. Independência comercial</h3>
        <p>
          A contratação do Plano Assessoria não constitui vínculo societário, empregatício, representação comercial, franquia ou sociedade entre a Equapar e a assessoria.
        </p>
        <p>
          A assessoria permanece responsável pelos serviços que presta diretamente aos seus clientes, sem prejuízo das responsabilidades legais da Equapar relativas ao funcionamento e à segurança da plataforma.
        </p>
        <h3>4. Personalização de documentos</h3>
        <p>
          A assessoria poderá inserir sua identidade visual, denominação comercial e logotipo nos documentos gerados pela plataforma, desde que possua autorização legítima para utilização desses elementos.
        </p>
        <p>
          A assessoria concede à Equapar autorização limitada, não exclusiva e temporária para reprodução desses elementos exclusivamente para execução das funcionalidades contratadas.
        </p>
        <p>A personalização visual não transfere à assessoria a titularidade do software, dos modelos proprietários ou da tecnologia utilizada pela Equapar.</p>
        <p>Os documentos poderão ser exportados e utilizados nas atividades contratadas, observadas a legislação e as autorizações aplicáveis.</p>
        <p>
          É vedada a utilização de marcas, símbolos ou identificações que induzam terceiros a acreditar falsamente que o documento foi emitido, aprovado ou certificado por órgão público.
        </p>
        <h3>5. Rastreabilidade</h3>
        <p>
          A personalização dos documentos não prejudicará a manutenção dos registros técnicos de geração, versão da metodologia de cálculo e origem das informações, necessários à segurança, à auditoria e à rastreabilidade da plataforma.
        </p>
      </div>
    </article>
  );
}
