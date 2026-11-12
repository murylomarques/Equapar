import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarCnpj } from "@/lib/cnpj";
import { diasAte, reais } from "@/lib/format";
import { acoesDoContrato } from "@/lib/prazos";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { adicionarCliente } from "../acoes";
import { BotaoCliente } from "./botao-cliente";

export const metadata: Metadata = { title: "Clientes | Equapar" };

export default async function Clientes() {
  const ctx = await contexto();
  if (ctx.conta.tipo !== "ASSESSORIA") redirect("/app/hoje");
  const empresas = await db.empresa.findMany({
    where: { contaId: ctx.conta.id },
    include: { contratos: { where: { arquivado: false }, include: { convencao: true, pedidos: true } } },
    orderBy: { razaoSocial: "asc" },
  });
  return (
    <>
      <div className="app-cab">
        <div>
          <h1>Todos os clientes</h1>
          <p className="secundario mb-0">{empresas.length} clientes nesta assessoria.</p>
        </div>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col" className="num">
                Contratos
              </th>
              <th scope="col" className="num">
                Prazos em 60 dias
              </th>
              <th scope="col" className="num">
                Pedidos abertos
              </th>
              <th scope="col" className="num">
                A receber
              </th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhum cliente ainda. Adicione o primeiro abaixo.
                </td>
              </tr>
            )}
            {empresas.map((e) => {
              const prazos = e.contratos.flatMap((c) => acoesDoContrato(c)).filter((a) => a.limite && diasAte(a.limite) <= 60).length;
              const abertos = e.contratos.flatMap((c) => c.pedidos).filter((p) => ["EM_ANALISE", "CALCULO_VALIDADO", "PROTOCOLADO"].includes(p.estado)).length;
              const receber = e.contratos.flatMap((c) => c.pedidos).filter((p) => ["DEFERIDO", "FATURADO"].includes(p.estado)).reduce((s, p) => s + Number(p.valorDeferido ?? 0), 0);
              return (
                <tr key={e.id}>
                  <td>
                    {e.razaoSocial}
                    <div className="legenda">{formatarCnpj(e.cnpj)}</div>
                  </td>
                  <td className="num">{e.contratos.length}</td>
                  <td className="num">{prazos}</td>
                  <td className="num">{abertos}</td>
                  <td className="num">{reais(receber)}</td>
                  <td>
                    <BotaoCliente id={e.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pode(ctx.papel, "editar_contratos") && (
        <div className="cartao mt-24" style={{ maxWidth: 640 }}>
          <h2>Adicionar cliente</h2>
          <FormAcao action={adicionarCliente} limparAoSalvar>
            <div className="linha-form">
              <div className="campo">
                <label htmlFor="cnpj">CNPJ</label>
                <input id="cnpj" name="cnpj" inputMode="numeric" />
              </div>
              <div className="campo">
                <label htmlFor="razaoSocial">Razão social (opcional)</label>
                <input id="razaoSocial" name="razaoSocial" />
              </div>
            </div>
            <label className="check" style={{ marginBottom: 16 }}>
              <input type="checkbox" name="importar" defaultChecked /> Importar os contratos do PNCP agora
            </label>
            <BotaoEnvio pendente="Adicionando…">Adicionar cliente</BotaoEnvio>
          </FormAcao>
        </div>
      )}
    </>
  );
}
