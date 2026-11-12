"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchX, WifiOff } from "lucide-react";
import { Selo } from "@/components/selo";
import { EtapasProgresso } from "@/components/ui/espera";
import { EstadoVazio } from "@/components/ui/apresentacao";
import type { ResultadoRaioX } from "@/lib/pncp";
import { seloVigencia } from "@/lib/prazos";
import { diasAte, data, plural } from "@/lib/format";
import { formatarCnpj } from "@/lib/cnpj";
import { FormAvisarDepois, FormRelatorio } from "./formularios";

type Estado = { fase: "consultando"; segundos: number } | { fase: "lendo"; r: ResultadoRaioX; etapa: number } | { fase: "pronto"; r: ResultadoRaioX } | { fase: "erro" } | { fase: "limite" };

export function ResultadoRaioXCliente({ cnpj }: { cnpj: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "consultando", segundos: 0 });

  useEffect(() => {
    let vivo = true;
    const relogio = window.setInterval(() => setEstado((e) => (e.fase === "consultando" ? { ...e, segundos: e.segundos + 1 } : e)), 1000);
    fetch(`/api/raio-x/consulta?cnpj=${cnpj}`)
      .then(async (res) => {
        if (res.status === 429) {
          if (vivo) setEstado({ fase: "limite" }); // S2: cota diária por IP
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as ResultadoRaioX;
        if (!vivo) return;
        // Etapas reais depois da resposta: ler os contratos e calcular o prazo de cada um.
        setEstado({ fase: "lendo", r, etapa: 1 });
        window.setTimeout(() => vivo && setEstado({ fase: "lendo", r, etapa: 2 }), 350);
        window.setTimeout(() => vivo && setEstado({ fase: "pronto", r }), 700);
      })
      .catch(() => vivo && setEstado({ fase: "erro" }))
      .finally(() => window.clearInterval(relogio));
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [cnpj]);

  if (estado.fase === "consultando" || estado.fase === "lendo") {
    const n = estado.fase === "lendo" ? estado.r.contratos.length : null;
    const etapa = estado.fase === "lendo" ? estado.etapa : 0;
    return (
      <div className="cartao" role="status" aria-live="polite" style={{ maxWidth: 640 }}>
        <h2>Consultando os contratos públicos</h2>
        <EtapasProgresso etapas={["Consultando o PNCP", n === null ? "Lendo os contratos" : `Lendo ${plural(n, "contrato", "contratos")}`, "Calculando prazos"]} atual={etapa} />
        {estado.fase === "consultando" && estado.segundos >= 10 && estado.segundos < 30 && <p className="ajuda-texto mt-16 mb-0">O PNCP está demorando mais que o normal. Seguimos tentando.</p>}
        {estado.fase === "consultando" && estado.segundos >= 30 && (
          <div className="mt-16">
            <p className="mb-8">Isso está levando mais que o normal. Quer que a gente avise por e-mail quando terminar?</p>
            <FormAvisarDepois cnpj={cnpj} />
          </div>
        )}
      </div>
    );
  }

  if (estado.fase === "limite")
    return (
      <div className="cartao" role="alert" style={{ maxWidth: 640 }}>
        <h2>Muitas consultas hoje</h2>
        <p className="secundario">Este endereço já fez o máximo de consultas do Raio-X por hoje. Tente amanhã, ou crie sua conta para acompanhar seus contratos sem limite.</p>
      </div>
    );

  if (estado.fase === "erro")
    return (
      <div className="cartao" role="alert" style={{ maxWidth: 640 }}>
        <WifiOff size={28} strokeWidth={1.5} aria-hidden style={{ color: "var(--grafite)" }} />
        <h2 className="mt-8">O PNCP não respondeu agora</h2>
        <p className="secundario">Tente de novo em alguns minutos ou deixe seu e-mail que avisamos quando a consulta terminar.</p>
        <FormAvisarDepois cnpj={cnpj} />
        <button type="button" className="btn btn-discreto mt-16" onClick={() => window.location.reload()}>
          Tentar de novo agora
        </button>
      </div>
    );

  const r = estado.r;
  if (r.contratos.length === 0)
    return (
      <EstadoVazio
        icone={SearchX}
        titulo="Não achamos contratos vigentes desse CNPJ no PNCP"
        porque="Contratos antigos podem não ter sido publicados. Quer cadastrar um contrato à mão?"
        acao={
          <Link href={`/criar-conta?cnpj=${cnpj}`} className="btn btn-primario">
            Cadastrar um contrato à mão
          </Link>
        }
      />
    );

  const proximos6 = r.contratos.filter((c) => diasAte(c.fim) <= 183).length;
  return (
    <div className="pilha" style={{ gap: 32 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>
          {r.razaoSocial ?? formatarCnpj(cnpj)} tem {plural(r.contratos.length, "contrato vigente", "contratos vigentes")} no PNCP. {proximos6}{" "}
          {proximos6 === 1 ? "termina" : "terminam"} nos próximos 6 meses.
        </h2>
        <p className="legenda">Consulta feita em {data(r.consultadoEm)}. Só dados públicos.</p>
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
              <div className="mt-8">
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
      <p className="legenda leitura">O Raio-X mostra só dados públicos e prazos. Ele não estima valor a recuperar, porque isso depende da planilha de custos e da convenção, que o CNPJ não revela.</p>
    </div>
  );
}
