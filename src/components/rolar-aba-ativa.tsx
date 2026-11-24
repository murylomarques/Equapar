"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Margem mantida entre a aba e a borda da faixa quando é preciso rolar. */
const MARGEM = 16;

/**
 * No celular, a faixa de abas rola de lado: traz a aba ativa para a vista a cada navegação.
 * Só rola quando a aba ativa não está inteira na vista (antes, a primeira aba chegava cortada).
 */
export function RolarAbaAtiva() {
  const caminho = usePathname();
  const busca = useSearchParams();
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".abas [aria-current='page'], .abas [aria-selected='true']").forEach((aba) => {
      const faixa = aba.parentElement;
      if (!faixa || faixa.scrollWidth <= faixa.clientWidth) return;
      const f = faixa.getBoundingClientRect();
      const a = aba.getBoundingClientRect();
      if (a.left < f.left) faixa.scrollLeft += a.left - f.left - MARGEM;
      else if (a.right > f.right) faixa.scrollLeft += a.right - f.right + MARGEM;
    });
  }, [caminho, busca]);
  return null;
}
