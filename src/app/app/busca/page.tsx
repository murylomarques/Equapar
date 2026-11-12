import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Scale, SearchX, LayoutList } from "lucide-react";
import { contexto, escopoContratos } from "@/lib/auth";
import { db } from "@/lib/db";
import { contratosDoContexto } from "@/lib/consultas";
import { data, MESES, plural } from "@/lib/format";
import { NOME_ESTADO } from "@/lib/pedido";
import { seloSituacao } from "@/lib/prazos";
import { Selo, SeloSimples } from "@/components/selo";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";

export const metadata: Metadata = { title: "Busca | Equapar" };

/** Destaca o termo buscado no texto (sem HTML vindo de dados). */
function Destaque({ texto, termo }: { texto: string; termo: string }) {
  if (!termo) return <>{texto}</>;
  const norm = (s: string) => s.toLowerCase(); // a busca no banco também diferencia acentos
  const alvo = norm(termo);
  const base = norm(texto);
  const partes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (alvo && (k = base.indexOf(alvo, i)) !== -1) {
    partes.push(texto.slice(i, k), <mark key={k}>{texto.slice(k, k + termo.length)}</mark>);
    i = k + termo.length;
  }
  partes.push(texto.slice(i));
  return <>{partes}</>;
}

const TIPOS = [
  { id: "", nome: "Tudo" },
  { id: "contratos", nome: "Contratos" },
  { id: "pedidos", nome: "Pedidos" },
  { id: "convencoes", nome: "Convenções" },
];

export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const ctx = await contexto();
  const { q = "", tipo = "" } = await searchParams;
  const termo = q.trim();
  const contem = { contains: termo, mode: "insensitive" as const };
  const [contratos, pedidos, convencoes] = termo
    ? await Promise.all([
        contratosDoContexto(ctx, { OR: [{ numero: contem }, { orgao: contem }, { objeto: contem }] }),
        db.pedido.findMany({
          where: { contrato: { AND: [escopoContratos(ctx), { OR: [{ numero: contem }, { orgao: contem }] }] } },
          include: { contrato: true },
          orderBy: { atualizadoEm: "desc" },
          take: 30,
        }),
        db.convencao.findMany({ where: { contaId: ctx.conta.id, OR: [{ nome: contem }, { sindicatos: contem }, { cidade: contem }] }, take: 30 }),
      ])
    : [[], [], []];
  const total = contratos.length + pedidos.length + convencoes.length;
  const mostra = (t: string) => !tipo || tipo === t;

  return (
    <>
      <CabecalhoPagina titulo="Buscar" subtitulo="Dica: aperte / em qualquer tela para buscar." />
      <form action="/app/busca" role="search" className="fileira" style={{ maxWidth: 640, marginBottom: 16 }}>
        <label htmlFor="q" className="sr-only">
          Número do contrato, órgão, objeto ou convenção
        </label>
        <input id="q" name="q" type="search" defaultValue={termo} placeholder="Número do contrato, órgão, objeto ou convenção" style={{ flex: 1 }} autoFocus={!termo} />
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        <button className="btn btn-primario" type="submit">
          Buscar
        </button>
      </form>
      {termo && (
        <nav className="filtros" aria-label="Filtrar por tipo">
          {TIPOS.map((t) => {
            const n = t.id === "contratos" ? contratos.length : t.id === "pedidos" ? pedidos.length : t.id === "convencoes" ? convencoes.length : total;
            return (
              <Link key={t.id} href={`/app/busca?q=${encodeURIComponent(termo)}${t.id ? `&tipo=${t.id}` : ""}`} className="filtro" aria-current={tipo === t.id ? "true" : undefined}>
                {t.nome} <span className="n">({n})</span>
              </Link>
            );
          })}
        </nav>
      )}
      {termo && total === 0 && (
        <EstadoVazio icone={SearchX} titulo={`Nada encontrado para “${termo}”`} porque="Tente o número do contrato (como 45/2025), parte do nome do órgão ou da convenção." />
      )}
      <div className="pilha" style={{ gap: 24 }}>
        {mostra("contratos") && contratos.length > 0 && (
          <section aria-labelledby="r-contratos">
            <h2 id="r-contratos" className="fileira">
              <LayoutList size={20} strokeWidth={1.5} aria-hidden /> {plural(contratos.length, "contrato", "contratos")}
            </h2>
            <ul className="lista-limpa pilha-8">
              {contratos.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/contratos/${c.id}`} className="cartao-linha entre">
                    <span style={{ minWidth: 0 }}>
                      <strong>
                        Contrato <Destaque texto={c.numero} termo={termo} /> · <Destaque texto={c.orgao} termo={termo} />
                      </strong>
                      <span className="legenda" style={{ display: "block" }}>
                        <Destaque texto={c.objeto.slice(0, 160)} termo={termo} /> · termina em {data(c.vigenciaFim)}
                      </span>
                    </span>
                    <Selo selo={seloSituacao(c)} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {mostra("pedidos") && pedidos.length > 0 && (
          <section aria-labelledby="r-pedidos">
            <h2 id="r-pedidos" className="fileira">
              <FileText size={20} strokeWidth={1.5} aria-hidden /> {plural(pedidos.length, "pedido", "pedidos")}
            </h2>
            <ul className="lista-limpa pilha-8">
              {pedidos.map((p) => (
                <li key={p.id}>
                  <Link href={p.estado === "EM_ANALISE" ? `/app/pedidos/${p.id}` : `/app/pedidos/${p.id}/pronto`} className="cartao-linha entre">
                    <strong>
                      Pedido do contrato <Destaque texto={p.contrato.numero} termo={termo} /> · <Destaque texto={p.contrato.orgao} termo={termo} />
                    </strong>
                    <SeloSimples texto={NOME_ESTADO[p.estado]} tom="neutro" icone="check" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {mostra("convencoes") && convencoes.length > 0 && (
          <section aria-labelledby="r-conv">
            <h2 id="r-conv" className="fileira">
              <Scale size={20} strokeWidth={1.5} aria-hidden /> {plural(convencoes.length, "convenção", "convenções")}
            </h2>
            <ul className="lista-limpa pilha-8">
              {convencoes.map((c) => (
                <li key={c.id}>
                  <Link href="/app/convencoes" className="cartao-linha">
                    <strong>
                      <Destaque texto={c.nome} termo={termo} />
                    </strong>
                    <span className="legenda">
                      {[c.cidade, c.uf].filter(Boolean).join("/")} · data-base em {MESES[c.mesDataBase - 1]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
