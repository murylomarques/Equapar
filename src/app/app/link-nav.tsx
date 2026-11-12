"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkNav({
  href,
  icone,
  children,
  contador,
  rotuloContador,
}: {
  href: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  contador?: number;
  rotuloContador?: string;
}) {
  const p = usePathname();
  const ativo = p === href || p.startsWith(`${href}/`) || (href === "/app/carteira" && p.startsWith("/app/contratos"));
  return (
    <Link href={href} aria-current={ativo ? "page" : undefined}>
      <span aria-hidden style={{ display: "inline-flex" }}>
        {icone}
      </span>
      {children}
      {!!contador && (
        <span className="contador-nav">
          {contador}
          <span className="sr-only"> {rotuloContador}</span>
        </span>
      )}
    </Link>
  );
}
