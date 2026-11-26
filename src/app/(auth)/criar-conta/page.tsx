import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCriarConta, FormEmpresa } from "../formularios";
import { ETAPAS_INICIO } from "@/lib/inicio";
import { normalizarCnpj } from "@/lib/mascaras";
import { metaPagina } from "@/app/(site)/seo";
import { googleAtivo, modoPiloto } from "@/lib/chaves";

export const metadata = metaPagina({ titulo: "Criar conta | Equapar", descricao: "Crie a conta grátis da sua empresa: a Equapar busca os contratos no PNCP e mostra os prazos de repactuação de cada um.", caminho: "/criar-conta" });

/** Rótulos curtos do passo a passo: cabem numa linha só, e os círculos ficam alinhados. */
const ROTULOS_CURTOS = ["Criar conta", "Contratos", "Convenções", "Carteira"] as const;

function Etapas({ atual }: { atual: number }) {
  return (
    <ol className="progresso" tabIndex={0} aria-label="Etapas até a carteira pronta" style={{ marginBottom: 20 }}>
      {ETAPAS_INICIO.map((e, i) => (
        <li key={e} className={i < atual ? "feito" : i === atual ? "atual" : undefined} aria-current={i === atual ? "step" : undefined} style={{ minWidth: 0 }}>
          <span>
            <span className="passo-marca" aria-hidden>
              {i + 1}
            </span>
            <span className="passo-rotulo passo-rotulo-curto" title={i === 0 ? undefined : e}>
              {ROTULOS_CURTOS[i] ?? e}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ cnpj?: string; tipo?: string; etapa?: string; nova?: string }> }) {
  const sp = await searchParams;
  // no modo piloto as assessorias ficam fora do site: a opção some, mas ?tipo=assessoria continua funcionando
  const assessoria = sp.tipo === "assessoria" || !modoPiloto();
  const s = await sessaoAtual();
  if (s && !s.pendente2fa) {
    const temConta = await db.membro.findFirst({ where: { usuarioId: s.usuarioId } });
    const nova = sp.nova === "1"; // S6: "Criar outra conta", pedido explícito de quem já tem conta
    if (temConta && !nova) redirect("/app/hoje");
    return (
      <div className="cartao">
        <h1>{nova ? "Criar outra conta" : "Sua empresa"}</h1>
        <p className="secundario">{nova ? "Uma conta nova, separada da atual, com os contratos de outra empresa." : "Falta só dizer de qual empresa são os contratos."}</p>
        <FormEmpresa novaConta={nova} assessoria={assessoria} />
      </div>
    );
  }
  return (
    <div className="cartao">
      <Etapas atual={0} />
      <h1>Criar conta</h1>
      <p className="secundario">Leva cerca de 1 minuto. Depois, a Equapar busca seus contratos no PNCP.</p>
      <FormCriarConta cnpj={sp.cnpj ? normalizarCnpj(sp.cnpj) : undefined} tipoInicial={sp.tipo === "assessoria" ? "ASSESSORIA" : "EMPRESA"} google={googleAtivo()} assessoria={assessoria} />
      <hr className="regua" />
      <p className="mb-0" style={{ fontSize: 14 }}>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
