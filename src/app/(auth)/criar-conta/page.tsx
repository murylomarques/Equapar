import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { soDigitos } from "@/lib/cnpj";
import { FormCriarConta, FormEmpresa } from "../formularios";
import { ETAPAS_INICIO } from "@/lib/inicio";

export const metadata: Metadata = { title: "Criar conta | Equapar" };


function Etapas({ atual }: { atual: number }) {
  return (
    <ol className="progresso" tabIndex={0} aria-label="Etapas até a carteira pronta" style={{ marginBottom: 20 }}>
      {ETAPAS_INICIO.map((e, i) => (
        <li key={e} className={i < atual ? "feito" : i === atual ? "atual" : undefined} aria-current={i === atual ? "step" : undefined} style={{ minWidth: 0 }}>
          <span>
            <span className="passo-marca" aria-hidden>
              {i + 1}
            </span>
            <span style={{ fontSize: 12 }}>{i === 0 ? "Criar conta" : e}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ cnpj?: string; tipo?: string; etapa?: string; nova?: string }> }) {
  const sp = await searchParams;
  const s = await sessaoAtual();
  if (s && !s.pendente2fa) {
    const temConta = await db.membro.findFirst({ where: { usuarioId: s.usuarioId } });
    const nova = sp.nova === "1"; // S6: "Criar outra conta", pedido explícito de quem já tem conta
    if (temConta && !nova) redirect("/app/hoje");
    return (
      <div className="cartao">
        <h1>{nova ? "Criar outra conta" : "Sua empresa"}</h1>
        <p className="secundario">{nova ? "Uma conta nova, separada da atual, com os contratos de outra empresa." : "Falta só dizer de qual empresa são os contratos."}</p>
        <FormEmpresa novaConta={nova} />
      </div>
    );
  }
  return (
    <div className="cartao">
      <Etapas atual={0} />
      <h1>Criar conta</h1>
      <p className="secundario">Leva cerca de 1 minuto. Depois, a Equapar busca seus contratos no PNCP.</p>
      <FormCriarConta cnpj={sp.cnpj ? soDigitos(sp.cnpj) : undefined} tipoInicial={sp.tipo === "assessoria" ? "ASSESSORIA" : "EMPRESA"} google={!!process.env.GOOGLE_CLIENT_ID} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
