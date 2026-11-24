import { cnpjValido, formatarCnpj } from "@/lib/cnpj";
import { ResultadoRaioXCliente } from "./resultado";
import { erroCnpj, normalizarCnpj } from "@/lib/mascaras";
import { FormCnpj } from "@/components/form-cnpj";
import { CONTRATOS_EXEMPLO, terminamEm6MesesExemplo } from "@/components/previas";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Raio-X grátis dos contratos públicos pelo CNPJ | Equapar",
  descricao: "Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP, quando cada um termina e quais estão perto do prazo de repactuação. Sem cadastro.",
  caminho: "/raio-x",
});

/** Os mesmos contratos fictícios das prévias da landing; a frase de resumo conta a partir da lista. */
function resumoExemplo() {
  const total = CONTRATOS_EXEMPLO.length;
  const n = terminamEm6MesesExemplo();
  const prazo = n === 0 ? "Nenhum termina nos próximos 6 meses." : n === 1 ? "1 termina nos próximos 6 meses." : `${n} terminam nos próximos 6 meses.`;
  return `Empresa Exemplo Ltda. tem ${total} contratos vigentes no PNCP. ${prazo}`;
}

export default async function RaioX({ searchParams }: { searchParams: Promise<{ cnpj?: string }> }) {
  const { cnpj: bruto } = await searchParams;
  const cnpj = normalizarCnpj(bruto ?? "");
  const invalido = !!bruto && !cnpjValido(cnpj);
  return (
    <div className="site-largura raiox-pagina">
      <h1 className="titulo-landing">Veja os prazos dos seus contratos públicos</h1>
      <div style={{ maxWidth: 560 }}>
        <FormCnpj
          key={bruto ?? ""}
          id="cnpj-raiox"
          valorInicial={bruto ? formatarCnpj(cnpj) : ""}
          erroInicial={invalido ? (erroCnpj(bruto ?? "") ?? "Esse CNPJ não existe. Confira os 14 caracteres.") : ""}
        />
        <p className="legenda" style={{ marginTop: 10 }}>
          Usamos só dados públicos do Portal Nacional de Contratações Públicas (PNCP). Não pedimos senha nem documento.
        </p>
      </div>
      {/* 5.4: o que o resultado mostra, e um exemplo com dados fictícios. Com CNPJ inválido, continua abaixo do erro */}
      {(!bruto || invalido) && (
        <div className="grade-2 mt-24" style={{ alignItems: "start" }}>
          <div className="leitura">
            <h2 style={{ fontSize: 20 }}>O que o Raio-X mostra</h2>
            <ul className="pilha-8" style={{ paddingLeft: 20 }}>
              <li>Os contratos vigentes da empresa publicados no PNCP, com órgão e valor global.</li>
              <li>Quando termina a vigência de cada um, e quanto tempo falta.</li>
              <li>Quais estão perto da prorrogação, o momento de pedir a repactuação antes de assinar.</li>
            </ul>
          </div>
          <figure className="cartao exemplo-raiox" style={{ margin: 0 }} aria-label="Exemplo de resultado com dados fictícios">
            <span className="selo selo-ambar">Exemplo · dados fictícios</span>
            <p className="mt-8" style={{ fontWeight: 600, marginBottom: 16 }}>
              {resumoExemplo()}
            </p>
            <ul className="lista-limpa exemplo-raiox-lista">
              {CONTRATOS_EXEMPLO.map((c) => (
                <li key={c.numero}>
                  <span className="exemplo-raiox-orgao">{c.orgao}</span>
                  <span className="legenda tnum">
                    Contrato {c.numero} · fim da vigência em {c.falta}
                  </span>
                </li>
              ))}
            </ul>
          </figure>
        </div>
      )}
      {bruto && !invalido && (
        <div className="mt-32">
          <ResultadoRaioXCliente key={cnpj} cnpj={cnpj} />
          <noscript>
            <p>Para ver o resultado, ative o JavaScript do navegador.</p>
          </noscript>
        </div>
      )}
    </div>
  );
}
