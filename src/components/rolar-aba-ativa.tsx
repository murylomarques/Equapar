"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** No celular, a faixa de abas rola de lado: traz a aba ativa para a vista a cada navegação. */
export function RolarAbaAtiva() {
  const caminho = usePathname();
  const busca = useSearchParams();
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".abas [aria-current='page'], .abas [aria-selected='true']").forEach((aba) => {
      const faixa = aba.parentElement;
      if (faixa && faixa.scrollWidth > faixa.clientWidth) faixa.scrollLeft = aba.offsetLeft - (faixa.clientWidth - aba.offsetWidth) / 2;
    });
  }, [caminho, busca]);
  return null;
}
