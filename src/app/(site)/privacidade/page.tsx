import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Política de privacidade | Equapar" };

export default function Privacidade() {
  return (
    <article className="site-largura secao guia">
      <h1>Política de privacidade</h1>
      <p className="aviso-caixa">Minuta. Revise com um profissional antes de publicar.</p>
      <h2>Quem somos</h2>
      <p>
        {SITE.razaoSocial}, CNPJ {SITE.cnpj}, {SITE.endereco}. Contato do encarregado: {SITE.email}.
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
      <h2>Com quem compartilhamos</h2>
      <p>Provedores de hospedagem, e-mail e WhatsApp, e o provedor de IA usado para ler planilhas em PDF quando você envia uma. Não vendemos dados.</p>
      <h2>Seus direitos</h2>
      <p>Você pode exportar todos os dados e excluir a conta em Configurações &gt; Dados, a qualquer momento, como pede a LGPD (Lei 13.709/2018).</p>
    </article>
  );
}
