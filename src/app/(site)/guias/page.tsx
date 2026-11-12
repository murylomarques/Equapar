import type { Metadata } from "next";
import Link from "next/link";
import { GUIAS } from "@/lib/guias";

export const metadata: Metadata = {
  title: "Guias de repactuação | Equapar",
  description: "Repactuação, prorrogação, convenção coletiva e reforma tributária em contratos públicos.",
};

export default function Guias() {
  return (
    <div className="site-largura secao">
      <h1 className="titulo-landing" style={{ fontSize: 40 }}>
        Guias
      </h1>
      <div className="pilha" style={{ maxWidth: 760 }}>
        {GUIAS.map((g) => (
          <Link key={g.slug} href={`/guias/${g.slug}`} className="cartao-linha">
            <strong style={{ fontSize: 18 }}>{g.titulo}</strong>
            <span className="secundario">{g.descricao}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
