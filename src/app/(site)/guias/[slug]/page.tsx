import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormCnpjServidor } from "@/components/form-cnpj-servidor";
import { Copiar } from "@/components/copiar";
import { Provedores } from "@/components/ui/provedores";
import { GUIAS } from "@/lib/guias";
import { guiaNoAr } from "@/lib/chaves";
import { metaPagina } from "../../seo";

export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  return g ? metaPagina({ titulo: `${g.titulo} | Equapar`, descricao: g.descricao, caminho: `/guias/${g.slug}`, tipo: "article" }) : {};
}

/** Parágrafo que é um modelo de texto entre aspas (ex.: a ressalva no termo aditivo): vira citação com botão de copiar. */
const modelo = (p: string) => (p.length > 2 && p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : null);

export default async function GuiaPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  if (!g || !guiaNoAr(slug)) notFound();
  return (
    <article className="site-largura secao">
      <div className="guia">
        <nav aria-label="Trilha" className="guia-trilha">
          <Link href="/guias">← Guias</Link>
        </nav>
        <h1 className="titulo-landing">{g.titulo}</h1>
        <p className="secundario guia-descricao">{g.descricao}</p>
        {g.secoes.map((s) => (
          <section key={s.titulo}>
            <h2>{s.titulo}</h2>
            {s.paragrafos.map((p) => {
              const texto = modelo(p);
              return texto ? (
                <div key={p} className="guia-modelo">
                  <blockquote>
                    <p>{texto}</p>
                  </blockquote>
                  <Provedores>
                    <Copiar texto={texto} rotulo="Copiar o modelo" />
                  </Provedores>
                </div>
              ) : (
                <p key={p}>{p}</p>
              );
            })}
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
        <section className="cartao guia-chamada" aria-labelledby="guia-chamada-titulo">
          <h2 id="guia-chamada-titulo">Veja os prazos dos seus contratos</h2>
          <p className="secundario">Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.</p>
          <FormCnpjServidor id="cnpj-guia" />
        </section>
      </div>
    </article>
  );
}
