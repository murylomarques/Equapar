import { cnpjValido, formatarCnpj } from "@/lib/cnpj";
import { ResultadoRaioXCliente } from "./resultado";
import { erroCnpj, normalizarCnpj } from "@/lib/mascaras";
import { FormCnpj } from "@/components/form-cnpj";
import { metaPagina } from "../seo";

export const metadata = metaPagina({
  titulo: "Raio-X grátis dos contratos públicos pelo CNPJ | Equapar",
  descricao: "Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP, quando cada um termina e quais estão perto do prazo de repactuação. Sem cadastro.",
  caminho: "/raio-x",
});

const EXEMPLO = [
  ["Prefeitura Municipal de Exemplo", "fim em 18/12/2026 · faltam 35 dias"],
  ["Tribunal Regional Exemplo", "fim em 03/2027 · faltam 5 meses"],
  ["Universidade Federal Exemplo", "fim em 08/2027 · faltam 9 meses"],
] as const;

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
      {/* 5.4: o que o resultado mostra, e um exemplo com dados fictícios */}
      {!bruto && (
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
              Empresa Exemplo Ltda. tem 3 contratos vigentes no PNCP. 1 termina nos próximos 6 meses.
            </p>
            <ul className="lista-limpa exemplo-raiox-lista">
              {EXEMPLO.map(([orgao, fim]) => (
                <li key={orgao}>
                  <span className="exemplo-raiox-orgao">{orgao}</span>
                  <span className="legenda tnum">{fim}</span>
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
