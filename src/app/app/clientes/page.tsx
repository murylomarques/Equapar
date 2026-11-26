import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { contexto, podeNaConta } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarCnpj } from "@/lib/cnpj";
import { hojeUTC, plural, reais } from "@/lib/format";
import { contratosComPrazoEm } from "@/lib/prazos";
import { aReceber, LANCAMENTOS_A_RECEBER } from "@/lib/a-receber";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CampoCnpj, CampoTexto, Interruptor } from "@/components/ui/campos";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { adicionarCliente } from "../acoes";
import { BotaoCliente, BotaoIrParaFormulario, ComecarDoTopo } from "./botao-cliente";

export const metadata: Metadata = { title: "Clientes | Equapar" };

export default async function Clientes() {
  const ctx = await contexto();
  if (ctx.conta.tipo !== "ASSESSORIA") redirect("/app/hoje");
  const empresas = await db.empresa.findMany({
    where: { contaId: ctx.conta.id },
    include: { contratos: { where: { arquivado: false }, include: { convencao: true, pedidos: { include: LANCAMENTOS_A_RECEBER } } } },
    orderBy: { razaoSocial: "asc" },
  });
  const podeEditar = podeNaConta(ctx, "editar_contratos");
  const hoje = hojeUTC();
  // Os mesmos números das outras telas: "Prazo em 60 dias" é o filtro da Carteira; "A receber", a tela A receber
  const numeros = new Map(
    empresas.map((e) => [
      e.id,
      {
        prazos: contratosComPrazoEm(e.contratos, 60, hoje).length,
        abertos: e.contratos.flatMap((c) => c.pedidos).filter((p) => ["EM_ANALISE", "CALCULO_VALIDADO", "PROTOCOLADO"].includes(p.estado)).length,
        receber: aReceber(e.contratos.flatMap((c) => c.pedidos)).total,
      },
    ]),
  );
  return (
    <>
      <CabecalhoPagina titulo="Todos os clientes" subtitulo={`${plural(empresas.length, "cliente", "clientes")} nesta assessoria.`} />
      {empresas.length === 0 ? (
        <div className="clientes-coluna">
          <ComecarDoTopo />
          <EstadoVazio
            icone={Users}
            titulo="Nenhum cliente ainda"
            porque="Adicione o primeiro cliente pelo CNPJ. A Equapar pode buscar os contratos dele no PNCP."
            acao={
              podeEditar ? (
                <BotaoIrParaFormulario alvo="adicionar-cliente" campo="cnpj">
                  Adicionar o primeiro cliente
                </BotaoIrParaFormulario>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
        <div className="tabela-rolagem so-desktop">
          <table className="tabela tabela-clientes">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col" className="num">
                  Contratos
                </th>
                <th scope="col" className="num">
                  Prazo em 60 dias
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
                const { prazos, abertos, receber } = numeros.get(e.id)!;
                return (
                  <tr key={e.id}>
                    <td>
                      <strong style={{ fontWeight: 600 }}>{e.razaoSocial}</strong>
                      <div className="legenda tnum" style={{ whiteSpace: "nowrap" }}>
                        {formatarCnpj(e.cnpj)}
                      </div>
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
        {/* celular: um cartão por cliente com os mesmos números (a tabela cortava 3 colunas) */}
        <div className="cartoes-celular">
          {empresas.map((e) => {
            const { prazos, abertos, receber } = numeros.get(e.id)!;
            return (
              <div key={e.id} className="cartao-linha">
                <strong>{e.razaoSocial}</strong>
                <span className="legenda tnum" style={{ display: "block", whiteSpace: "nowrap" }}>
                  {formatarCnpj(e.cnpj)}
                </span>
                <span className="legenda" style={{ display: "block" }}>
                  {plural(e.contratos.length, "contrato", "contratos")} · {plural(prazos, "contrato", "contratos")} com prazo em 60 dias · {plural(abertos, "pedido aberto", "pedidos abertos")} · a receber {reais(receber)}
                </span>
                <div className="mt-8">
                  <BotaoCliente id={e.id} />
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
      {podeEditar && (
        <div className="cartao mt-24 clientes-coluna" id="adicionar-cliente">
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
