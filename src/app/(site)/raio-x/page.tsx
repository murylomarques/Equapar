import type { Metadata } from "next";
import { FormCnpj } from "@/components/form-cnpj";
import { cnpjValido, formatarCnpj, soDigitos } from "@/lib/cnpj";
import { ResultadoRaioXCliente } from "./resultado";

export const metadata: Metadata = {
  title: "Raio-X grátis dos contratos públicos | Equapar",
  description: "Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.",
};

export default async function RaioX({ searchParams }: { searchParams: Promise<{ cnpj?: string }> }) {
  const { cnpj: bruto } = await searchParams;
  const cnpj = soDigitos(bruto ?? "");
  return (
    <div className="site-largura" style={{ paddingTop: 40, paddingBottom: 24 }}>
      <h1 className="titulo-landing" style={{ fontSize: 38, lineHeight: "44px" }}>
        Veja os prazos dos seus contratos públicos
      </h1>
      <div style={{ maxWidth: 560 }}>
        <FormCnpj id="cnpj-raiox" valorInicial={bruto ? formatarCnpj(cnpj) : ""} />
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
            <p className="mt-8 mb-8" style={{ fontWeight: 600 }}>
              Empresa Exemplo Ltda. tem 3 contratos vigentes no PNCP. 1 termina nos próximos 6 meses.
            </p>
            <ul className="lista-limpa pilha-8" style={{ font: "var(--t-tabela)" }}>
              <li className="entre">
                <span>Prefeitura Municipal de Exemplo</span>
                <span className="tnum">fim 18/12/2026 · faltam 35 dias</span>
              </li>
              <li className="entre">
                <span>Tribunal Regional Exemplo</span>
                <span className="tnum">fim 03/2027 · faltam 5 meses</span>
              </li>
              <li className="entre">
                <span>Universidade Federal Exemplo</span>
                <span className="tnum">fim 08/2027 · faltam 9 meses</span>
              </li>
            </ul>
          </figure>
        </div>
      )}
      <div className="mt-32">
        {!bruto ? null : !cnpjValido(cnpj) ? (
          <p className="erro-texto" role="alert">
            Esse CNPJ não existe. Confira os 14 números.
          </p>
        ) : (
          <ResultadoRaioXCliente key={cnpj} cnpj={cnpj} />
        )}
        {bruto && cnpjValido(cnpj) && (
          <noscript>
            <p>Para ver o resultado, ative o JavaScript do navegador.</p>
          </noscript>
        )}
      </div>
    </div>
  );
}
