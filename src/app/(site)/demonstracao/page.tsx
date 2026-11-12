import type { Metadata } from "next";
import Link from "next/link";
import { ehDemo, sessaoAtual } from "@/lib/auth";
import { entrarNaDemonstracao } from "./acoes";

export const metadata: Metadata = { title: "Demonstração | Equapar" };

export default async function Demonstracao() {
  const s = await sessaoAtual();
  const real = s && !s.pendente2fa && !ehDemo(s);
  return (
    <section className="secao">
      <div className="site-largura" style={{ maxWidth: 640 }}>
        <h1 className="titulo-secao">Ver a Equapar por dentro</h1>
        {real ? (
          <>
            <p className="leitura">
              Você está conectado como <strong>{s.usuario.nome}</strong>. Para ver a demonstração, saia da sua conta ou abra esta página numa janela anônima.
            </p>
            <div className="fileira mt-24">
              <Link href="/app/hoje" className="btn btn-primario">
                Voltar para a minha conta
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="leitura">
              Uma empresa fictícia de limpeza com contratos, prazos, pedidos e valores a receber. Você navega por todas as telas; nada do que aparece é de uma empresa
              real, e a demonstração não envia e-mail nem WhatsApp.
            </p>
            <form action={entrarNaDemonstracao} className="mt-24">
              <button type="submit" className="btn btn-primario">
                Entrar na demonstração
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
