import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormCnpj } from "@/components/form-cnpj";
import { GUIAS } from "@/lib/guias";

export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  return g ? { title: `${g.titulo} | Equapar`, description: g.descricao } : {};
}

export default async function GuiaPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  if (!g) notFound();
  return (
    <article className="site-largura secao">
      <div className="guia">
        <h1 className="titulo-landing" style={{ fontSize: 38 }}>
          {g.titulo}
        </h1>
        <p className="secundario" style={{ fontSize: 18 }}>
          {g.descricao}
        </p>
        {g.secoes.map((s) => (
          <section key={s.titulo}>
            <h2>{s.titulo}</h2>
            {s.paragrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.lista && (
              <ul>
                {s.lista.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <h2>Fontes</h2>
        <ul>
          {g.fontes.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer">
                {f.nome}
              </a>
            </li>
          ))}
        </ul>
        <p className="legenda">Conteúdo informativo. Não substitui a análise de um profissional habilitado no seu caso.</p>
        <div className="cartao mt-24">
          <h2 className="mt-0">Veja os prazos dos seus contratos</h2>
          <p className="secundario">Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.</p>
          <FormCnpj id="cnpj-guia" />
        </div>
      </div>
    </article>
  );
}
