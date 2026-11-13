import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Componentes de apresentação sem estado: podem receber ícones de páginas do servidor. */

// ============================================================ Estado vazio

export function EstadoVazio({
  icone: I,
  titulo,
  porque,
  acao,
  className = "cartao",
}: {
  icone: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  titulo: string;
  porque?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`estado-vazio ${className}`}>
      <I size={32} strokeWidth={1.5} aria-hidden />
      <h2>{titulo}</h2>
      {porque && <p>{porque}</p>}
      {acao && <div className="fileira" style={{ justifyContent: "center" }}>{acao}</div>}
    </div>
  );
}

// ============================================================ Cartão de número

export function CartaoNumero({
  href,
  icone: I,
  rotulo,
  valor,
  detalhe,
  tom,
  rotuloCurto,
}: {
  href: string;
  icone: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  tom?: "carimbo" | "azul" | "verde";
  /** 5.2: rótulo da faixa compacta do celular */
  rotuloCurto?: string;
}) {
  const cor = tom === "carimbo" ? "var(--carimbo)" : tom === "azul" ? "var(--selo-azul-tx)" : tom === "verde" ? "var(--verde)" : "var(--grafite)";
  return (
    <Link href={href} className="cartao cartao-numero">
      <span className="rotulo-n">
        <span style={{ color: cor, display: "inline-flex" }}>
          <I size={18} strokeWidth={1.5} aria-hidden />
        </span>
        {rotuloCurto ? (
          <>
            <span className="rotulo-longo">{rotulo}</span>
            <span className="rotulo-curto">{rotuloCurto}</span>
          </>
        ) : (
          rotulo
        )}
      </span>
      <span className="valor-n" style={{ display: "block" }}>
        {valor}
      </span>
      {detalhe && (
        <span className="det-n fileira" style={{ gap: 4 }}>
          {detalhe} <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </Link>
  );
}

