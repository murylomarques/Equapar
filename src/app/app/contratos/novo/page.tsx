import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { SemPermissao } from "@/components/sem-permissao";
import { db } from "@/lib/db";
import { convencoesParaForm } from "@/lib/dto";
import { CabecalhoPagina, EstadoVazio } from "@/components/ui/estrutura";
import { FormContrato } from "../form-contrato";
import { criarContrato } from "../../acoes";

export const metadata: Metadata = { title: "Cadastrar contrato | Equapar" };

export default async function NovoContrato() {
  const ctx = await contexto();
  if (!pode(ctx.papel, "editar_contratos")) return <SemPermissao acao="cadastrar contratos" />;
  const convencoes = await db.convencao.findMany({ where: { contaId: ctx.conta.id }, orderBy: { ano: "desc" } });
  if (!ctx.empresas.length)
    return (
      <EstadoVazio
        icone={Users}
        titulo="Adicione um cliente primeiro"
        porque="Cada contrato pertence a um cliente da assessoria."
        acao={
          <Link href="/app/clientes" className="btn btn-primario">
            Adicionar cliente
          </Link>
        }
      />
    );
  return (
    <div style={{ maxWidth: 760 }}>
      <CabecalhoPagina
        trilha={[{ rotulo: "Carteira", href: "/app/carteira" }, { rotulo: "Cadastrar contrato" }]}
        titulo="Cadastrar contrato"
        subtitulo="Para contratos que não estão no PNCP. Os dados vêm do contrato assinado."
      />
      <div className="cartao">
        <FormContrato
          action={criarContrato}
          convencoes={convencoesParaForm(convencoes)}
          empresas={ctx.empresas.map((e) => ({ id: e.id, razaoSocial: e.razaoSocial }))}
          empresaId={ctx.empresaId}
        />
      </div>
    </div>
  );
}
