import Link from "next/link";
import { PreviaPronto } from "@/components/previas";
import { entrarNaDemonstracao } from "../demonstracao/acoes";
import { Captcha } from "@/components/captcha";
import { modoPiloto } from "@/lib/chaves";
import { notFound } from "next/navigation";
import { Contato } from "@/components/contato";
import { PRECOS } from "@/lib/planos";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Repactuação para assessorias e escritórios | Equapar",
  descricao: "Todos os prazos e pedidos de repactuação dos seus clientes numa tela, com memória de cálculo e a sua marca nos PDFs.",
  caminho: "/assessorias",
});

export default function Assessorias() {
  if (modoPiloto()) notFound(); // A6
  return (
    <div className="site-largura secao">
      <div className="grade-2" style={{ alignItems: "center" }}>
        <div>
          <p className="sobretitulo">Para assessorias de licitação, contadores e advogados</p>
          <h1 className="titulo-landing">
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
            <strong>
              R$ {PRECOS.assessoria.toLocaleString("pt-BR")} por mês, até {PRECOS.assessoriaClientes()} clientes e {PRECOS.assessoriaPostosIncluidos.toLocaleString("pt-BR")} postos somados; R$ {PRECOS.assessoriaPorPostoExtra} por posto acima disso.
            </strong>
          </p>
          <div className="fileira">
            <form action={entrarNaDemonstracao}>
              <input type="hidden" name="tipo" value="assessoria" />
              <Captcha />
              <button type="submit" className="btn btn-primario">
                Ver a demonstração com 3 clientes
              </button>
            </form>
            <Contato agenda />
          </div>
          <p className="legenda mt-8">
            Na demonstração, os clientes, contratos e valores são fictícios. Nada é enviado por e-mail ou WhatsApp. Prefere começar direto?{" "}
            <Link href="/criar-conta?tipo=assessoria">Criar conta de assessoria</Link>.
          </p>
        </div>
        <PreviaPronto />
      </div>
    </div>
  );
}
