import type { Metadata } from "next";
import Link from "next/link";
import { contexto, pode } from "@/lib/auth";
import { SemPermissao } from "@/components/sem-permissao";
import { db } from "@/lib/db";
import { FormContrato } from "../form-contrato";
import { criarContrato } from "../../acoes";

export const metadata: Metadata = { title: "Cadastrar contrato | Equapar" };

export default async function NovoContrato() {
  const ctx = await contexto();
  if (!pode(ctx.papel, "editar_contratos")) return <SemPermissao acao="cadastrar contratos" />;
  const convencoes = await db.convencao.findMany({ where: { contaId: ctx.conta.id }, orderBy: { ano: "desc" } });
  if (!ctx.empresas.length)
    return (
      <div className="cartao vazio">
        <p>Adicione um cliente antes de cadastrar contratos.</p>
        <Link href="/app/clientes" className="btn btn-primario">
          Adicionar cliente
        </Link>
      </div>
    );
  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Cadastrar contrato</h1>
      <p className="secundario">Para contratos que não estão no PNCP. Os dados críticos vêm do contrato assinado.</p>
      <div className="cartao">
        <FormContrato action={criarContrato} convencoes={convencoes} empresas={ctx.empresas} empresaId={ctx.empresaId} />
      </div>
    </div>
  );
}
