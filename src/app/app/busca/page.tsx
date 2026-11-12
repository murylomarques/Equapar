import type { Metadata } from "next";
import Link from "next/link";
import { contexto } from "@/lib/auth";
import { contratosDoContexto } from "@/lib/consultas";
import { data } from "@/lib/format";
import { seloSituacao } from "@/lib/prazos";
import { Selo } from "@/components/selo";

export const metadata: Metadata = { title: "Busca | Equapar" };

export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await contexto();
  const { q = "" } = await searchParams;
  const termo = q.trim();
  const resultados = termo
    ? await contratosDoContexto(ctx, {
        OR: [
          { numero: { contains: termo, mode: "insensitive" } },
          { orgao: { contains: termo, mode: "insensitive" } },
          { objeto: { contains: termo, mode: "insensitive" } },
        ],
      })
    : [];
  return (
    <>
      <h1>Buscar contrato</h1>
      <form action="/app/busca" role="search" className="fileira" style={{ maxWidth: 560, marginBottom: 24 }}>
        <label htmlFor="q" className="sr-only">
          Número do contrato, órgão ou objeto
        </label>
        <input id="q" name="q" type="search" defaultValue={termo} placeholder="Número do contrato, órgão ou objeto" style={{ flex: 1 }} />
        <button className="btn" type="submit">
          Buscar
        </button>
      </form>
      {termo && resultados.length === 0 && <p className="secundario">Nada encontrado para &ldquo;{termo}&rdquo;.</p>}
      <ul className="lista-limpa pilha-8">
        {resultados.map((c) => (
          <li key={c.id}>
            <Link href={`/app/contratos/${c.id}`} className="cartao-linha entre">
              <span>
                <strong>
                  Contrato {c.numero} · {c.orgao}
                </strong>
                <span className="legenda">
                  {c.objeto.slice(0, 140)} · termina em {data(c.vigenciaFim)}
                </span>
              </span>
              <Selo selo={seloSituacao(c)} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
