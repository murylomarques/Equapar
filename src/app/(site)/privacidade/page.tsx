import { identificacaoEmpresa } from "@/lib/site";
import { metaPagina } from "../seo";
import { subprocessadores } from "@/lib/subprocessadores";

export const metadata = metaPagina({
  titulo: "Política de privacidade | Equapar",
  descricao: "Que dados a Equapar trata no Raio-X, nos avisos e na conta, os subprocessadores, a guarda após o cancelamento e os seus direitos pela LGPD.",
  caminho: "/privacidade",
});

export default function Privacidade() {
  const empresa = identificacaoEmpresa();
  const subs = subprocessadores();
  return (
    <article className="site-largura secao">
      {/* mesma margem esquerda das outras páginas: a coluna de leitura fica dentro da largura do site */}
      <div className="guia documento-legal">
        <h1 className="titulo-landing">Política de privacidade</h1>
        <p className="legenda documento-data">Atualizado em 28/11/2026.</p>
        <h2>Quem somos</h2>
        <p>
          {empresa.texto}. Canal do titular de dados e do encarregado: <a href={`mailto:${empresa.canal}`}>{empresa.canal}</a>.
        </p>
        <h2>Os dois papéis da Equapar</h2>
        <ul>
          <li>
            <strong>Operadora</strong> dos documentos que o cliente envia (planilhas, convenções, folhas): tratamos esses dados em nome do cliente, conforme as instruções dele, só para prestar o serviço.
          </li>
          <li>
            <strong>Controladora</strong> dos dados de cadastro, segurança e cobrança: nome, e-mail, senha (guardada com hash), registros de acesso e faturas.
          </li>
        </ul>
        <p>
          <strong>Não envie folha com nomes ou CPFs de empregados.</strong> A planilha de custos basta para o cálculo.
        </p>
        <h2>Que dados tratamos e por quê</h2>
        <ul>
          <li>
            <strong>Raio-X:</strong> o CNPJ digitado, para consultar dados públicos do PNCP. Contratos de pessoa física (CPF) são descartados na entrada.
          </li>
          <li>
            <strong>Relatório e avisos:</strong> e-mail e, se você quiser, WhatsApp, para mandar o relatório e os avisos de prazo. WhatsApp só com autorização registrada; responder SAIR encerra os avisos.
          </li>
          <li>
            <strong>Conta:</strong> nome, e-mail de trabalho e senha (guardada com hash), dados dos contratos, planilhas e documentos que você envia, para prestar o serviço.
          </li>
          <li>
            <strong>Métricas de uso:</strong> eventos do produto sem dado pessoal. Cookies não essenciais só com consentimento; hoje usamos apenas o cookie de sessão.
          </li>
        </ul>
        <h2>Subprocessadores (os que estão ligados hoje)</h2>
        <ul>
          {subs.map((x) => (
            <li key={x.papel}>
              <strong>{x.papel}:</strong> {x.quem}
              {x.internacional ? " (pode haver transferência internacional de dados, nos termos do art. 33 da LGPD)" : ""}.
            </li>
          ))}
        </ul>
        <p>Não vendemos dados.</p>
        <h2>Guarda depois do cancelamento</h2>
        <p>
          Com a cobrança encerrada, a conta fica só para leitura e você pode exportar tudo por 30 dias. Depois disso, os documentos que você enviou podem ser apagados. Os dados que a lei
          manda guardar, como cobrança e registros de acesso, ficam separados e são mantidos pelo prazo legal.
        </p>
        {/* parecer do advogado de 28/11/2026 (B3), transcrito; o canal vem do ambiente (SITE_EMAIL_CONTATO) */}
        <h2>Tratamento de dados de clientes do plano Assessoria</h2>
        <h3>1. Agentes de tratamento</h3>
        <p>
          A Equapar atuará como controladora dos dados pessoais necessários à administração de contas, contratação, faturamento, segurança da plataforma e cumprimento de suas próprias obrigações legais.
        </p>
        <p>
          Quanto aos dados pessoais inseridos pelos contratantes para execução dos serviços disponibilizados pela plataforma, a Equapar atuará, conforme as circunstâncias concretas do tratamento, como operadora ou suboperadora, observando as instruções lícitas do respectivo controlador.
        </p>
        <p>A assessoria poderá atuar como controladora ou operadora dos dados de seus clientes, conforme as finalidades e responsabilidades efetivamente assumidas.</p>
        <h3>2. Finalidades</h3>
        <p>
          Os dados inseridos na plataforma poderão ser tratados para armazenamento, organização, processamento de informações, elaboração de cálculos, geração de documentos, acompanhamento contratual, suporte técnico, segurança e auditoria das operações contratadas.
        </p>
        <p>
          Os dados não serão comercializados nem utilizados para publicidade ou treinamento de modelos de inteligência artificial sem fundamento jurídico específico e informação adequada aos envolvidos.
        </p>
        <h3>3. Minimização de dados</h3>
        <p>O tratamento será limitado às informações necessárias para execução das funcionalidades contratadas.</p>
        <p>Deverá ser evitada a inserção de informações pessoais individualizadas quando dados agregados ou anonimizados forem suficientes para a finalidade pretendida.</p>
        <h3>4. Segurança e segregação</h3>
        <p>
          A Equapar adotará medidas técnicas e administrativas proporcionais aos riscos do tratamento, incluindo controles de acesso, segregação lógica entre empresas, proteção das informações e registros de atividades relevantes.
        </p>
        <p>O acesso às informações será restrito aos usuários autorizados e aos profissionais cuja atuação seja necessária à prestação dos serviços.</p>
        <h3>5. Prestadores de serviços</h3>
        <p>
          A Equapar poderá contratar prestadores tecnológicos para hospedagem, processamento, armazenamento, segurança e demais atividades necessárias ao funcionamento da plataforma.
        </p>
        <p>Esses prestadores estarão sujeitos a obrigações de proteção de dados, confidencialidade e segurança compatíveis com as atividades realizadas.</p>
        <p>Eventuais transferências internacionais de dados deverão observar os mecanismos e requisitos previstos na LGPD e na regulamentação da ANPD.</p>
        <h3>6. Direitos dos titulares</h3>
        <p>As solicitações relacionadas aos direitos dos titulares serão atendidas pela Equapar quando esta atuar como controladora.</p>
        <p>
          Quando atuar como operadora ou suboperadora, a Equapar prestará o auxílio necessário ao respectivo controlador para atendimento das solicitações, observadas as responsabilidades legalmente atribuídas a cada agente.
        </p>
        <h3>7. Incidentes de segurança</h3>
        <p>
          Ao tomar conhecimento de incidente que envolva dados tratados em nome de terceiros, a Equapar comunicará o responsável contratual sem demora injustificada, fornecendo as informações disponíveis necessárias à avaliação, mitigação e cumprimento das obrigações legais.
        </p>
        <h3>8. Retenção e exclusão</h3>
        <p>Os dados serão mantidos durante o período necessário à execução dos serviços e pelo prazo de exportação disponibilizado após o encerramento contratual.</p>
        <p>Após esse período, serão eliminados ou anonimizados, ressalvadas as hipóteses de conservação legalmente autorizadas.</p>
        <h3>9. Canal de atendimento</h3>
        <p>
          As solicitações relativas à privacidade e à proteção de dados pessoais poderão ser encaminhadas para <a href={`mailto:${empresa.canal}`}>{empresa.canal}</a>.
        </p>
        <h2>Seus direitos</h2>
        <p>
          Você pode exportar todos os dados e excluir a conta em Configurações &gt; Dados, a qualquer momento, como pede a LGPD (Lei 13.709/2018). Para qualquer pedido do titular, escreva para{" "}
          <a href={`mailto:${empresa.canal}`}>{empresa.canal}</a>.
        </p>
      </div>
    </article>
  );
}
