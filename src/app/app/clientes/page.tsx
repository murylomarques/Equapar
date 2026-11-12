import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarCnpj } from "@/lib/cnpj";
import { diasAte, plural, reais } from "@/lib/format";
import { acoesDoContrato } from "@/lib/prazos";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CampoCnpj, CampoTexto, Interruptor } from "@/components/ui/campos";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
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
  const podeEditar = pode(ctx.papel, "editar_contratos");
  return (
    <>
      <CabecalhoPagina titulo="Todos os clientes" subtitulo={`${plural(empresas.length, "cliente", "clientes")} nesta assessoria.`} />
      {empresas.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhum cliente ainda" porque="Adicione o primeiro cliente pelo CNPJ. A Equapar pode buscar os contratos dele no PNCP." />
      ) : (
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
              {empresas.map((e) => {
                const prazos = e.contratos.flatMap((c) => acoesDoContrato(c)).filter((a) => a.limite && diasAte(a.limite) <= 60).length;
                const abertos = e.contratos.flatMap((c) => c.pedidos).filter((p) => ["EM_ANALISE", "CALCULO_VALIDADO", "PROTOCOLADO"].includes(p.estado)).length;
                const receber = e.contratos
                  .flatMap((c) => c.pedidos)
                  .filter((p) => ["DEFERIDO", "FATURADO"].includes(p.estado))
                  .reduce((s, p) => s + Number(p.valorDeferido ?? 0), 0);
                return (
                  <tr key={e.id}>
                    <td>
                      <strong style={{ fontWeight: 600 }}>{e.razaoSocial}</strong>
                      <div className="legenda tnum">{formatarCnpj(e.cnpj)}</div>
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
      )}
      {podeEditar && (
        <div className="cartao mt-24" style={{ maxWidth: 640 }}>
          <h2>Adicionar cliente</h2>
          <FormAcao action={adicionarCliente} limparAoSalvar>
            <CampoCnpj nome="cnpj" rotulo="CNPJ do cliente" />
            <CampoTexto nome="razaoSocial" rotulo="Razão social" opcional ajuda="Em branco, usamos a publicada no PNCP." />
            <Interruptor nome="importar" rotulo="Importar os contratos do PNCP agora" descricao="Pode levar alguns segundos." valorInicial />
            <div className="mt-16">
              <BotaoEnvio pendente="Adicionando e consultando o PNCP…">Adicionar cliente</BotaoEnvio>
            </div>
          </FormAcao>
        </div>
      )}
    </>
  );
}
