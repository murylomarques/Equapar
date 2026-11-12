/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export function Logo({ negativo, href = "/", largura = 120 }: { negativo?: boolean; href?: string; largura?: number }) {
  return (
    <Link href={href} aria-label="Equapar, página inicial" style={{ display: "inline-flex", lineHeight: 0 }}>
      <img src={negativo ? "/equapar-logo-negativo.svg" : "/equapar-logo.svg"} alt="equapar" width={largura} height={Math.round((largura * 158) / 545)} />
    </Link>
  );
}
