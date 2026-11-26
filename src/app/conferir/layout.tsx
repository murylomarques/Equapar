import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Provedores } from "@/components/ui/provedores";
// a memória usa as mesmas regras visuais da área logada
import "../app/app.css";
import "../app/pedidos/pedidos.css";

export const dynamic = "force-dynamic";

// link de leitura enviado a um contador: fora da busca
export const metadata: Metadata = { title: "Conferência da memória de cálculo | Equapar", robots: { index: false, follow: false } };

export default function ConferirLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 48px" }}>
      <header className="entre mb-16" style={{ alignItems: "center" }}>
        <Logo largura={120} />
        <span className="legenda">Conferência só de leitura</span>
      </header>
      <main id="conteudo">
        <Provedores>{children}</Provedores>
      </main>
      <footer className="mt-32" style={{ borderTop: "1px solid var(--linha, #e3ded3)", paddingTop: 16 }}>
        <p className="legenda mb-0">
          A Equapar organiza prazos, memória de cálculo e documentos da repactuação de contratos públicos. <Link href="/">Conheça a Equapar</Link>
        </p>
      </footer>
    </div>
  );
}
