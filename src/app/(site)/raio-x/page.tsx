import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormCnpj } from "@/components/form-cnpj";
import { Selo } from "@/components/selo";
import { cnpjValido, formatarCnpj, soDigitos } from "@/lib/cnpj";
import { registrarEvento } from "@/lib/eventos";
import { data, diasAte, dataLocal } from "@/lib/format";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";
import { seloVigencia } from "@/lib/prazos";
import { FormRelatorio, FormAvisarDepois } from "./formularios";

export const metadata: Metadata = {
  title: "Raio-X grátis dos contratos públicos | Equapar",
  description: "Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.",
};

export default async function RaioX({ searchParams }: { searchParams: Promise<{ cnpj?: string }> }) {
  const { cnpj: bruto } = await searchParams;
  const cnpj = soDigitos(bruto ?? "");
  return (
    <div className="site-largura" style={{ paddingTop: 40 }}>
      <h1 className="titulo-landing" style={{ fontSize: 38 }}>
        Veja os prazos dos seus contratos públicos
      </h1>
      <div style={{ maxWidth: 560 }}>
        <FormCnpj id="cnpj-raiox" valorInicial={bruto ? formatarCnpj(cnpj) : ""} />
        <p className="legenda" style={{ marginTop: 10 }}>
          Usamos só dados públicos do Portal Nacional de Contratações Públicas (PNCP). Não pedimos senha nem documento.
        </p>
      </div>
      <div className="mt-24">
        {!bruto ? null : !cnpjValido(cnpj) ? (
          <p className="erro-texto" role="alert">
            Esse CNPJ não existe. Confira os 14 números.
          </p>
        ) : (
          <Suspense key={cnpj} fallback={<Carregando />}>
            <Resultado cnpj={cnpj} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function Carregando() {
  return (
    <div role="status" aria-live="polite">
      <p className="secundario">Consultando o PNCP. Leva até 10 segundos.</p>
      <div className="tabela-rolagem" style={{ padding: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="fileira" style={{ padding: "14px 0", borderBottom: i < 2 ? "1px solid var(--linha)" : 0 }}>
            <span className="esqueleto" style={{ width: "22%" }} />
            <span className="esqueleto" style={{ width: "40%" }} />
            <span className="esqueleto" style={{ width: "12%" }} />
            <span className="esqueleto" style={{ width: "14%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

async function Resultado({ cnpj }: { cnpj: string }) {
  await registrarEvento("raiox_consultado");
  let r;
  try {
    r = await consultarPncp(cnpj);
  } catch (e) {
    if (e instanceof PncpIndisponivel) {
      return (
        <div className="cartao" role="alert">
          <p>O PNCP não respondeu agora. Tente de novo em alguns minutos ou deixe seu e-mail que avisamos quando a consulta terminar.</p>
          <FormAvisarDepois cnpj={cnpj} />
        </div>
      );
    }
    throw e;
  }
  await registrarEvento("raiox_resultado", { contratos: r.contratos.length });

  if (r.contratos.length === 0) {
    return (
      <div className="cartao vazio">
        <p>Não achamos contratos vigentes desse CNPJ no PNCP. Contratos antigos podem não ter sido publicados.</p>
        <Link href={`/criar-conta?cnpj=${cnpj}`} className="btn">
          Quer cadastrar um contrato à mão?
        </Link>
      </div>
    );
  }

  const proximos6 = r.contratos.filter((c) => diasAte(c.fim) <= 183).length;
  return (
    <div className="pilha" style={{ gap: 32 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>
          {r.razaoSocial ?? formatarCnpj(cnpj)} tem {r.contratos.length} {r.contratos.length === 1 ? "contrato vigente" : "contratos vigentes"} no PNCP. {proximos6}{" "}
          {proximos6 === 1 ? "termina" : "terminam"} nos próximos 6 meses.
        </h2>
        <p className="legenda">Consulta feita em {dataLocal(r.consultadoEm)}.</p>
        <div className="tabela-rolagem so-desktop">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Órgão</th>
                <th scope="col">Objeto</th>
                <th scope="col" className="num">
                  Fim da vigência
                </th>
                <th scope="col">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {r.contratos.map((c) => (
                <tr key={c.controle}>
                  <td>
                    {c.orgao}
                    <div className="legenda">{[c.municipio, c.uf].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    <span className="objeto" title={c.objeto}>
                      {c.objeto}
                    </span>
                  </td>
                  <td className="num">{data(c.fim)}</td>
                  <td>
                    <Selo selo={seloVigencia(c.fim)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cartoes-celular">
          {r.contratos.map((c) => (
            <div key={c.controle} className="cartao-linha">
              <strong>{c.orgao}</strong>
              <span className="legenda">Fim da vigência: {data(c.fim)}</span>
              <div style={{ marginTop: 6 }}>
                <Selo selo={seloVigencia(c.fim)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grade-2">
        <div className="cartao">
          <h2>O que fazer agora</h2>
          <ol style={{ paddingLeft: 20, margin: 0 }} className="pilha-8">
            <li>Confira se a convenção coletiva deste ano já foi depositada</li>
            <li>Separe a planilha de custos da proposta</li>
            <li>Antes de assinar a prorrogação, peça a repactuação ou registre a ressalva</li>
          </ol>
          <hr className="regua" />
          <Link href={`/criar-conta?cnpj=${cnpj}`}>Montar meu primeiro pedido com a Equapar</Link>
        </div>
        <div className="cartao">
          <h2>Receber o relatório e os avisos</h2>
          <FormRelatorio cnpj={cnpj} />
        </div>
      </div>
      <p className="legenda leitura">
        O Raio-X mostra só dados públicos e prazos. Ele não estima valor a recuperar, porque isso depende da planilha de custos e da convenção, que o CNPJ não revela.
      </p>
    </div>
  );
}
