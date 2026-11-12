import type { Metadata } from "next";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { data, MESES, dataLocal } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { SeloSimples } from "@/components/selo";
import { salvarConvencao } from "../acoes";
import type { Convencao } from "@prisma/client";

export const metadata: Metadata = { title: "Convenções | Equapar" };

function CamposConvencao({ c }: { c?: Convencao }) {
  const sufixo = c?.id ?? "nova";
  const ano = new Date().getFullYear();
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="campo">
        <label htmlFor={`nome-${sufixo}`}>Nome</label>
        <input id={`nome-${sufixo}`} name="nome" defaultValue={c?.nome} placeholder="CCT Asseio e Conservação ES 2026" />
      </div>
      <div className="campo">
        <label htmlFor={`sind-${sufixo}`}>Sindicatos</label>
        <input id={`sind-${sufixo}`} name="sindicatos" defaultValue={c?.sindicatos ?? ""} />
      </div>
      <div className="linha-form">
        <div className="campo">
          <label htmlFor={`cidade-${sufixo}`}>Cidade (base territorial)</label>
          <input id={`cidade-${sufixo}`} name="cidade" defaultValue={c?.cidade ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor={`uf-${sufixo}`}>UF</label>
          <input id={`uf-${sufixo}`} name="uf" maxLength={2} defaultValue={c?.uf} />
        </div>
        <div className="campo">
          <label htmlFor={`ano-${sufixo}`}>Ano</label>
          <input id={`ano-${sufixo}`} name="ano" type="number" defaultValue={c?.ano ?? ano} />
        </div>
        <div className="campo">
          <label htmlFor={`mes-${sufixo}`}>Mês da data-base</label>
          <select id={`mes-${sufixo}`} name="mesDataBase" defaultValue={c?.mesDataBase ?? ""}>
            <option value="" disabled>
              Escolha
            </option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="linha-form">
        <div className="campo">
          <label htmlFor={`dep-${sufixo}`}>Data do depósito (Mediador)</label>
          <input id={`dep-${sufixo}`} name="dataDeposito" type="date" defaultValue={c?.dataDeposito?.toISOString().slice(0, 10) ?? ""} />
          <span className="ajuda">Vazio = convenção ainda pendente.</span>
        </div>
        <div className="campo">
          <label htmlFor={`reg-${sufixo}`}>Número do registro</label>
          <input id={`reg-${sufixo}`} name="registroMte" defaultValue={c?.registroMte ?? ""} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`arq-${sufixo}`}>PDF da convenção</label>
        <input id={`arq-${sufixo}`} name="arquivo" type="file" accept=".pdf" />
      </div>
    </>
  );
}

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
      <div className="app-cab">
        <div>
          <h1>Convenções</h1>
          <p className="secundario mb-0">Biblioteca das convenções coletivas usadas nos contratos.</p>
        </div>
      </div>
      <div className="grade-2" style={{ alignItems: "start" }}>
        <div className="pilha">
          {convs.length === 0 && (
            <div className="cartao vazio">
              <p>Nenhuma convenção ainda.</p>
            </div>
          )}
          {convs.map((c) => (
            <details key={c.id} className="cartao">
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div className="entre">
                  <strong>{c.nome}</strong>
                  {c.situacao === "REGISTRADA" ? (
                    <SeloSimples texto={`Depositada em ${data(c.dataDeposito)}`} tom="verde" icone="check" />
                  ) : (
                    <SeloSimples texto="Pendente" tom="ambar" icone="relogio" />
                  )}
                </div>
                <div className="legenda">
                  {[c.cidade, c.uf].filter(Boolean).join("/")} · data-base {MESES[c.mesDataBase - 1]} · {c._count.contratos} {c._count.contratos === 1 ? "contrato" : "contratos"}
                  {c.registroMte ? ` · registro ${c.registroMte}` : ""}
                </div>
              </summary>
              {c.documentos.length > 0 && (
                <ul className="lista-limpa mt-16">
                  {c.documentos.map((d) => (
                    <li key={d.id}>
                      <a href={`/api/documentos/${d.id}`}>{d.nome}</a> <span className="legenda">{dataLocal(d.criadoEm)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && (
                <FormAcao action={salvarConvencao} className="mt-16">
                  <CamposConvencao c={c} />
                  <BotaoEnvio className="btn">Salvar</BotaoEnvio>
                </FormAcao>
              )}
            </details>
          ))}
        </div>
        {podeEditar && (
          <div className="cartao">
            <h2>Cadastrar convenção</h2>
            <FormAcao action={salvarConvencao} limparAoSalvar>
              <CamposConvencao />
              <BotaoEnvio>Cadastrar</BotaoEnvio>
            </FormAcao>
          </div>
        )}
      </div>
    </>
  );
}
