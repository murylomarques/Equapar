import type { Metadata } from "next";
import Link from "next/link";
import { contexto, NOME_PAPEL } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CabecalhoPagina } from "@/components/ui/estrutura";
import { trocarConta } from "../acoes";

export const metadata: Metadata = { title: "Contas | Equapar" };

/** L14: as contas de que a pessoa participa; troca a conta da sessão. */
export default async function TrocarConta() {
  const ctx = await contexto();
  const membros = await db.membro.findMany({ where: { usuarioId: ctx.usuario.id }, include: { conta: true }, orderBy: { criadoEm: "asc" } });
  return (
    <>
      <CabecalhoPagina titulo="Contas" subtitulo="As contas de que você participa. Cada uma tem os próprios contratos, pessoas e plano." />
      <div className="cartao" style={{ maxWidth: 720 }}>
        <ul className="lista-limpa pilha-8">
          {membros.map((m) => (
            <li key={m.contaId} className="entre" style={{ alignItems: "center" }}>
              <span>
                <strong style={{ fontWeight: 500 }}>{m.conta.nome}</strong>
                <span className="legenda" style={{ display: "block" }}>
                  {m.conta.tipo === "ASSESSORIA" ? "Assessoria" : "Empresa"} · seu papel: {NOME_PAPEL[m.papel]}
                </span>
              </span>
              {m.contaId === ctx.conta.id ? (
                <span className="selo selo-verde">Conta atual</span>
              ) : (
                <FormAcao action={trocarConta}>
                  <input type="hidden" name="contaId" value={m.contaId} />
                  <BotaoEnvio className="btn btn-pequeno">Usar esta conta</BotaoEnvio>
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
        <hr className="regua" />
        <Link href="/criar-conta?etapa=empresa&nova=1" className="btn">
          Criar outra conta
        </Link>
      </div>
    </>
  );
}
