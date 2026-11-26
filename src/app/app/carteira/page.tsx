import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Layers, SearchX } from "lucide-react";
import { contexto, podeNaConta } from "@/lib/auth";
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
import { JORNADA, afetadoPelaJornada } from "@/lib/jornada";
import { jornadaEmSimulacao, jornadaVisivelPara, MARCA_SIMULACAO_JORNADA } from "@/lib/jornada-acesso";

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
  // 5.1: contratos de mão de obra dedicada que seguem vigentes quando a nova jornada começar
  { id: "jornada", nome: "Afetados pela jornada de 40 horas", teste: (c) => afetadoPelaJornada(c) },
  { id: "pedido", nome: "Pedido em andamento", teste: (c) => c.pedidos.some((p) => !["RECEBIDO", "INDEFERIDO"].includes(p.estado)) },
];

export default async function Carteira({ searchParams }: { searchParams: Promise<{ filtro?: string; uf?: string; esfera?: string }> }) {
  const ctx = await contexto();
  const sp = await searchParams;
  const todos = await contratosDoContexto(ctx);
  const ufs = [...new Set(todos.map((c) => c.uf).filter(Boolean))].sort() as string[];
  const esferas = [...new Set(todos.map((c) => c.esfera).filter(Boolean))] as string[];

  // D0: o filtro e o lote da jornada só existem para quem pode ver a jornada
  const verJornada = jornadaVisivelPara(ctx.usuario.email);
  const filtros = FILTROS.filter((f) => f.id !== "jornada" || verJornada);
  const filtro = filtros.find((f) => f.id === sp.filtro);
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
  const podeEditar = podeNaConta(ctx, "editar_contratos");
  const podeLote = podeNaConta(ctx, "editar_pedidos");
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
      prazoCurto: pp ? rotuloCurtoPrazo(pp.titulo) : "",
      selo: seloSituacao(c),
      pedir: !!op && !op.pedidoAberto,
      ressalvar: !!op && !op.pedidoAberto && !op.convencaoRegistrada,
    };
  });
  const n = (f: (c: ContratoCompleto) => boolean) => todos.filter(f).length;
  const semPedidoJornada = todos.filter((c) => afetadoPelaJornada(c) && !c.pedidos.some((p) => p.gatilho === "JORNADA_EC141" && p.estado !== "INDEFERIDO"));

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

      {verJornada && jornadaEmSimulacao() && sp.filtro === "jornada" && (
        <Alerta tipo="atencao" className="mb-16" titulo={MARCA_SIMULACAO_JORNADA} />
      )}
      {verJornada && podeLote && sp.filtro === "jornada" && semPedidoJornada.length > 0 && (
        <Alerta
          tipo="atencao"
          className="mb-16"
          titulo={`${plural(semPedidoJornada.length, "contrato afetado", "contratos afetados")} pela jornada sem pedido de reequilíbrio`}
          acao={
            <FormAcao action={iniciarPedidosEmLote}>
              <input type="hidden" name="motivo" value="JORNADA" />
              {semPedidoJornada.map((c) => (
                <input key={c.id} type="hidden" name="contratoId" value={c.id} />
              ))}
              <BotaoEnvio className="btn btn-pequeno" pendente="Montando os pedidos…">
                <Layers size={16} strokeWidth={1.5} aria-hidden /> Montar os pedidos destes {semPedidoJornada.length} contratos
              </BotaoEnvio>
            </FormAcao>
          }
        >
          A nova jornada começa em {data(JORNADA.inicio42())} (42 horas) e {data(JORNADA.inicio40())} (40 horas), datas a confirmar com o jurídico. Cada pedido escolhe o cenário: manter ou reduzir as horas.
        </Alerta>
      )}

      <nav className="filtros" aria-label="Filtros rápidos">
        <Link href={link({ filtro: undefined })} className="filtro" aria-current={!sp.filtro ? "true" : undefined}>
          Todos <span className="n">({todos.length})</span>
        </Link>
        {filtros.map((f) => (
          <Link key={f.id} href={link({ filtro: sp.filtro === f.id ? undefined : f.id })} className="filtro" aria-current={sp.filtro === f.id ? "true" : undefined}>
            {f.nome} <span className="n">({n(f.teste)})</span>
          </Link>
        ))}
      </nav>
      {(ufs.length > 1 || esferas.length > 1) && (
        <form action="/app/carteira" method="get" className="filtros-local" aria-label="Filtrar por local">
          {sp.filtro && <input type="hidden" name="filtro" value={sp.filtro} />}
          {ufs.length > 1 && (
            <span className="filtro-select">
              <label htmlFor="filtro-uf">UF</label>
              <select id="filtro-uf" name="uf" defaultValue={sp.uf ?? ""}>
                <option value="">Todas</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u} ({n((c) => c.uf === u)})
                  </option>
                ))}
              </select>
            </span>
          )}
          {esferas.length > 1 && (
            <span className="filtro-select">
              <label htmlFor="filtro-esfera">Esfera</label>
              <select id="filtro-esfera" name="esfera" defaultValue={sp.esfera ?? ""}>
                <option value="">Todas</option>
                {esferas.map((e) => (
                  <option key={e} value={e}>
                    {ESFERAS[e] ?? e} ({n((c) => c.esfera === e)})
                  </option>
                ))}
              </select>
            </span>
          )}
          <button type="submit" className="btn btn-pequeno">
            Filtrar
          </button>
          {(sp.uf || sp.esfera) && (
            <Link href={link({ uf: undefined, esfera: undefined })} className="btn btn-discreto btn-pequeno">
              Limpar local
            </Link>
          )}
        </form>
      )}

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

/** Rótulo curto do próximo prazo para a coluna da tabela (o título completo fica no title). */
function rotuloCurtoPrazo(titulo: string) {
  if (titulo.startsWith("Data-limite para pedir a repactuação")) return "Pedir repactuação";
  if (titulo.startsWith("Data-limite para ressalvar")) return "Ressalvar no aditivo";
  if (titulo.startsWith("Data-base da convenção")) return "Data-base CCT";
  if (titulo.startsWith("Previsão de assinatura da prorrogação")) return "Prorrogação prevista";
  if (titulo.startsWith("Assinatura efetiva da prorrogação")) return "Prorrogação assinada";
  if (titulo.startsWith("Prazo preferencial de resposta")) return "Resposta do órgão";
  return titulo.replace(/\s*\(.*\)\s*$/, "");
}
