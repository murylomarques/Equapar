import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Layers, SearchX } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { contratosDoContexto, type ContratoCompleto } from "@/lib/consultas";
import { contratosComPrazoEm, oportunidade, proximoPrazo, seloSituacao } from "@/lib/prazos";
import { data, MESES, plural, reais } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { Alerta, CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { importarPncp } from "../acoes";
import { iniciarPedidosEmLote } from "../pedidos/acoes";
import { TabelaCarteira, type LinhaCarteira } from "./tabela-carteira";

export const metadata: Metadata = { title: "Carteira | Equapar" };

const ESFERAS: Record<string, string> = { F: "Federal", E: "Estadual", M: "Municipal", D: "Distrital" };

const FILTROS: { id: string; nome: string; teste: (c: ContratoCompleto) => boolean }[] = [
  {
    id: "prazo30",
    nome: "Prazo em 30 dias",
    teste: (c) => contratosComPrazoEm([c], 30).length > 0, // L1: mesmo conjunto do cartão de Hoje
  },
  {
    id: "prazo60",
    nome: "Prazo em 60 dias",
    teste: (c) => contratosComPrazoEm([c], 60).length > 0,
  },
  { id: "semconvencao", nome: "Sem convenção informada", teste: (c) => c.maoDeObraDedicada && c.tipoReajuste === "REPACTUACAO" && !c.convencao },
  { id: "pedido", nome: "Pedido em andamento", teste: (c) => c.pedidos.some((p) => !["RECEBIDO", "INDEFERIDO"].includes(p.estado)) },
];

export default async function Carteira({ searchParams }: { searchParams: Promise<{ filtro?: string; uf?: string; esfera?: string }> }) {
  const ctx = await contexto();
  const sp = await searchParams;
  const todos = await contratosDoContexto(ctx);
  const ufs = [...new Set(todos.map((c) => c.uf).filter(Boolean))].sort() as string[];
  const esferas = [...new Set(todos.map((c) => c.esfera).filter(Boolean))] as string[];

  const filtro = FILTROS.find((f) => f.id === sp.filtro);
  let contratos = todos;
  if (filtro) contratos = contratos.filter(filtro.teste);
  if (sp.uf) contratos = contratos.filter((c) => c.uf === sp.uf);
  if (sp.esfera) contratos = contratos.filter((c) => c.esfera === sp.esfera);

  // Lote: contratos da mesma convenção com repactuação a pedir e sem pedido aberto
  const lotes = new Map<string, { nome: string; ids: string[] }>();
  for (const c of todos) {
    const op = oportunidade(c);
    if (op && !op.pedidoAberto && c.convencao) {
      const l = lotes.get(c.convencao.id) ?? { nome: c.convencao.nome, ids: [] };
      l.ids.push(c.id);
      lotes.set(c.convencao.id, l);
    }
  }
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/app/carteira${s ? `?${s}` : ""}`;
  };
  const podeEditar = pode(ctx.papel, "editar_contratos");
  const podeLote = pode(ctx.papel, "editar_pedidos");
  const linhas: LinhaCarteira[] = contratos.map((c) => {
    const pp = proximoPrazo(c);
    const op = oportunidade(c);
    return {
      id: c.id,
      numero: c.numero,
      empresa: c.empresa.razaoSocial,
      orgao: c.orgao,
      local: [c.municipio, c.uf].filter(Boolean).join(" · "),
      postos: c.postos,
      valorMensal: c.valorMensal ? Number(c.valorMensal) : null,
      valorMensalTxt: c.valorMensal ? reais(c.valorMensal) : "—",
      convencaoId: c.convencaoId,
      convencao: c.convencao ? `${c.convencao.nome} (${MESES[c.convencao.mesDataBase - 1]})` : null,
      fim: c.vigenciaFim.toISOString(),
      fimTxt: data(c.vigenciaFim),
      prazoData: pp ? pp.data.toISOString() : null,
      prazoTxt: pp ? data(pp.data) : "—",
      prazoTitulo: pp?.titulo ?? "",
      selo: seloSituacao(c),
      pedir: !!op && !op.pedidoAberto,
    };
  });
  const n = (f: (c: ContratoCompleto) => boolean) => todos.filter(f).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Carteira"
        subtitulo={`${plural(todos.length, "contrato", "contratos")}${ctx.conta.tipo === "ASSESSORIA" && !ctx.empresaId ? " de todos os clientes" : ""}`}
        acao={
          podeEditar ? (
            <>
              {ctx.empresaId && (
                <FormAcao action={importarPncp}>
                  <input type="hidden" name="empresaId" value={ctx.empresaId} />
                  <BotaoEnvio className="btn" pendente="Consultando o PNCP…">
                    Atualizar do PNCP
                  </BotaoEnvio>
                </FormAcao>
              )}
              <Link href="/app/contratos/novo" className="btn btn-primario">
                Cadastrar contrato
              </Link>
            </>
          ) : undefined
        }
      />

      {podeLote &&
        [...lotes.entries()]
          .filter(([, l]) => l.ids.length > 1)
          .map(([id, l]) => (
            <Alerta
              key={id}
              tipo="atencao"
              className="mb-16"
              titulo={`${plural(l.ids.length, "contrato", "contratos")} da ${l.nome} com repactuação a pedir`}
              acao={
                <FormAcao action={iniciarPedidosEmLote}>
                  {l.ids.map((i) => (
                    <input key={i} type="hidden" name="contratoId" value={i} />
                  ))}
                  <BotaoEnvio className="btn btn-pequeno" pendente="Montando os pedidos…">
                    <Layers size={16} strokeWidth={1.5} aria-hidden /> Montar pedidos para os {l.ids.length} contratos desta convenção
                  </BotaoEnvio>
                </FormAcao>
              }
            >
              A mesma planilha e a mesma convenção servem para todos. Você revisa cada pedido depois.
            </Alerta>
          ))}

      <nav className="filtros" aria-label="Filtros rápidos">
        <Link href={link({ filtro: undefined })} className="filtro" aria-current={!sp.filtro ? "true" : undefined}>
          Todos <span className="n">({todos.length})</span>
        </Link>
        {FILTROS.map((f) => (
          <Link key={f.id} href={link({ filtro: sp.filtro === f.id ? undefined : f.id })} className="filtro" aria-current={sp.filtro === f.id ? "true" : undefined}>
            {f.nome} <span className="n">({n(f.teste)})</span>
          </Link>
        ))}
        {ufs.length > 1 &&
          ufs.map((u) => (
            <Link key={u} href={link({ uf: sp.uf === u ? undefined : u })} className="filtro" aria-current={sp.uf === u ? "true" : undefined}>
              {u} <span className="n">({n((c) => c.uf === u)})</span>
            </Link>
          ))}
        {esferas.length > 1 &&
          esferas.map((e) => (
            <Link key={e} href={link({ esfera: sp.esfera === e ? undefined : e })} className="filtro" aria-current={sp.esfera === e ? "true" : undefined}>
              {ESFERAS[e] ?? e} <span className="n">({n((c) => c.esfera === e)})</span>
            </Link>
          ))}
      </nav>

      {contratos.length === 0 ? (
        todos.length === 0 ? (
          <EstadoVazio
            icone={FolderOpen}
            titulo="Nenhum contrato ainda"
            porque="A carteira junta os contratos da empresa e os prazos de cada um. Importe do PNCP pelo CNPJ ou cadastre à mão."
            acao={
              podeEditar ? (
                <>
                  <Link href="/app/boas-vindas" className="btn btn-primario">
                    Importar do PNCP
                  </Link>
                  <Link href="/app/contratos/novo" className="btn">
                    Cadastrar à mão
                  </Link>
                </>
              ) : undefined
            }
          />
        ) : (
          <EstadoVazio icone={SearchX} titulo="Nenhum contrato com este filtro" porque="Tire o filtro para ver a carteira toda." acao={<Link href="/app/carteira" className="btn">Ver todos</Link>} />
        )
      ) : (
        <TabelaCarteira linhas={linhas} mostrarEmpresa={ctx.conta.tipo === "ASSESSORIA" && !ctx.empresaId} podeLote={podeLote} />
      )}
    </>
  );
}
