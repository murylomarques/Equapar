import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormCnpjServidor } from "@/components/form-cnpj-servidor";
import { Copiar } from "@/components/copiar";
import { Provedores } from "@/components/ui/provedores";
import { GUIAS } from "@/lib/guias";
import { guiaNoAr } from "@/lib/chaves";
import { jsonLdGuia, metaPagina } from "../../seo";

export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  return g ? metaPagina({ titulo: `${g.titulo} | Equapar`, descricao: g.descricao, caminho: `/guias/${g.slug}`, tipo: "article", indexar: g.revisao !== "pendente" }) : {};
}

/** Parágrafo que é um modelo de texto entre aspas (ex.: a ressalva no termo aditivo): vira citação com botão de copiar. */
const modelo = (p: string) => (p.length > 2 && p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : null);

/** Parágrafo comum, ou modelo de texto com botão de copiar. */
function paragrafo(p: string) {
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
            }

/** "2026-11-27" → "27/11/2026" (data fixa do conteúdo, sem fuso). */
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export default async function GuiaPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIAS.find((x) => x.slug === slug);
  if (!g || !guiaNoAr(slug)) notFound();
  const relacionados = (g.relacionados ?? []).map((s) => GUIAS.find((x) => x.slug === s)).filter((x): x is NonNullable<typeof x> => !!x && guiaNoAr(x.slug));
  return (
    <article className="site-largura secao">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdGuia(g) }} />
      <div className="guia">
        {g.revisao === "pendente" && (
          <p className="selo selo-ambar" role="note">
            Rascunho em revisão jurídica: não publicado
          </p>
        )}
        <nav aria-label="Trilha" className="guia-trilha">
          <Link href="/guias">← Guias</Link>
        </nav>
        <h1 className="titulo-landing">{g.titulo}</h1>
        <p className="secundario guia-descricao">{g.descricao}</p>
        {g.atualizadoEm && (
          <p className="legenda guia-data">
            Atualizado em <time dateTime={g.atualizadoEm}>{dataBr(g.atualizadoEm)}</time>
          </p>
        )}
        {g.resumo?.length ? (
          <section className="guia-resumo" aria-labelledby="guia-resumo-titulo">
            <h2 id="guia-resumo-titulo">Em resumo</h2>
            <ul>
              {g.resumo.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {g.secoes.map((s) => (
          <section key={s.titulo}>
            <h2>{s.titulo}</h2>
            {s.paragrafos.map(paragrafo)}
            {s.lista && (
              <ul>
                {s.lista.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {s.tabela && (
              <div className="guia-tabela" role="region" aria-label={s.tabela.legenda ?? s.titulo} tabIndex={0}>
                <table>
                  {s.tabela.legenda && <caption>{s.tabela.legenda}</caption>}
                  <thead>
                    <tr>
                      {s.tabela.cabecalho.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.tabela.linhas.map((linha, i) => (
                      <tr key={i}>
                        {linha.map((celula, j) =>
                          j === 0 ? (
                            <th key={j} scope="row">
                              {celula}
                            </th>
                          ) : (
                            <td key={j}>{celula}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.paragrafosDepois?.map(paragrafo)}
          </section>
        ))}
        {g.faq?.length ? (
          <section className="faq guia-faq" aria-labelledby="guia-faq-titulo">
            <h2 id="guia-faq-titulo">Perguntas frequentes</h2>
            {g.faq.map((f) => (
              <details key={f.pergunta}>
                <summary>{f.pergunta}</summary>
                <p>{f.resposta}</p>
              </details>
            ))}
          </section>
        ) : null}
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
        {relacionados.length > 0 && (
          <nav className="guia-relacionados" aria-labelledby="guia-relacionados-titulo">
            <h2 id="guia-relacionados-titulo">Leia também</h2>
            <ul className="lista-limpa">
              {relacionados.map((r) => (
                <li key={r.slug}>
                  <Link href={`/guias/${r.slug}`}>{r.titulo}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <section className="cartao guia-chamada" aria-labelledby="guia-chamada-titulo">
          <h2 id="guia-chamada-titulo">Veja os prazos dos seus contratos</h2>
          <p className="secundario">Digite o CNPJ e veja os contratos vigentes da sua empresa no PNCP e quando cada um termina.</p>
          <FormCnpjServidor id="cnpj-guia" />
        </section>
      </div>
    </article>
  );
}
