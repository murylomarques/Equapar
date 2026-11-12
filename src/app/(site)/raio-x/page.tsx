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
