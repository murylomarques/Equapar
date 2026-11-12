"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkNav({ href, icone, children }: { href: string; icone: React.ReactNode; children: React.ReactNode }) {
  const p = usePathname();
  const ativo = p === href || p.startsWith(`${href}/`) || (href === "/app/carteira" && p.startsWith("/app/contratos"));
  return (
    <Link href={href} aria-current={ativo ? "page" : undefined}>
      <span aria-hidden style={{ display: "inline-flex" }}>
        {icone}
      </span>
      {children}
    </Link>
  );
}
