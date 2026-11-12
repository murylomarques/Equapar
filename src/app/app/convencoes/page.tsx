import type { Metadata } from "next";
import { FileText, Scale } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { data, dataLocal, MESES, paraInputData, plural } from "@/lib/format";
import { SeloSimples } from "@/components/selo";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { EditarConvencao, NovaConvencao } from "./form-convencao";

export const metadata: Metadata = { title: "Convenções | Equapar" };

export default async function Convencoes() {
  const ctx = await contexto();
  const convs = await db.convencao.findMany({
    where: { contaId: ctx.conta.id },
    include: { _count: { select: { contratos: true } }, documentos: { orderBy: { criadoEm: "desc" } } },
    orderBy: [{ ano: "desc" }, { nome: "asc" }],
  });
  const podeEditar = pode(ctx.papel, "editar_pedidos");
  return (
    <>
      <CabecalhoPagina titulo="Convenções" subtitulo="Biblioteca das convenções coletivas usadas nos contratos. A data-base de cada uma dispara os avisos." />
      <div className="grade-2">
        <div className="pilha">
          {convs.length === 0 && (
            <EstadoVazio icone={Scale} titulo="Nenhuma convenção ainda" porque="Cadastre a convenção da categoria para a Equapar avisar a data-base e montar os pedidos." />
          )}
          {convs.map((c) => (
            <article key={c.id} className="cartao">
              <div className="entre" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <h2 className="mb-0">{c.nome}</h2>
                  <p className="legenda mb-0 mt-8">
                    {[c.cidade, c.uf].filter(Boolean).join("/")} · data-base em {MESES[c.mesDataBase - 1]} · {plural(c._count.contratos, "contrato", "contratos")}
                    {c.registroMte ? ` · registro ${c.registroMte}` : ""}
                  </p>
                </div>
                <div className="fileira">
                  {c.situacao === "REGISTRADA" ? (
                    <SeloSimples texto={`Depositada em ${data(c.dataDeposito)}`} tom="verde" icone="check" />
                  ) : (
                    <SeloSimples texto="Pendente" tom="ambar" icone="relogio" />
                  )}
                  {podeEditar && (
                    <EditarConvencao
                      c={{
                        id: c.id,
                        nome: c.nome,
                        sindicatos: c.sindicatos,
                        cidade: c.cidade,
                        uf: c.uf,
                        ano: c.ano,
                        mesDataBase: c.mesDataBase,
                        dataDeposito: c.dataDeposito ? paraInputData(c.dataDeposito) : null,
                        registroMte: c.registroMte,
                      }}
                    />
                  )}
                </div>
              </div>
              {c.documentos.length > 0 && (
                <ul className="lista-limpa pilha-8 mt-16">
                  {c.documentos.map((d) => (
                    <li key={d.id} className="fileira" style={{ fontSize: 14 }}>
                      <FileText size={16} strokeWidth={1.5} aria-hidden style={{ color: "var(--grafite)" }} />
                      <a href={`/api/documentos/${d.id}`}>{d.nome}</a> <span className="legenda">{dataLocal(d.criadoEm)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
        {podeEditar && (
          <div className="cartao">
            <h2>Cadastrar convenção</h2>
            <NovaConvencao />
          </div>
        )}
      </div>
    </>
  );
}
