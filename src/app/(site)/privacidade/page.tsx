import type { Metadata } from "next";
import { identificacaoEmpresa } from "@/lib/site";
import { subprocessadores } from "@/lib/subprocessadores";

export const metadata: Metadata = { title: "Política de privacidade | Equapar" };

export default function Privacidade() {
  const empresa = identificacaoEmpresa();
  const subs = subprocessadores();
  return (
    <article className="site-largura secao guia">
      <h1>Política de privacidade</h1>
      <p className="aviso-caixa">MINUTA. Revise com um profissional antes de publicar.</p>
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
      <h2>Seus direitos</h2>
      <p>
        Você pode exportar todos os dados e excluir a conta em Configurações &gt; Dados, a qualquer momento, como pede a LGPD (Lei 13.709/2018). Para qualquer pedido do titular, escreva para{" "}
        <a href={`mailto:${empresa.canal}`}>{empresa.canal}</a>.
      </p>
    </article>
  );
}
