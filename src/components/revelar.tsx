"use client";
import { useEffect, useRef } from "react";

/**
 * Bloco da landing que aparece com opacidade + 8 px ao entrar na tela, uma vez.
 * O conteúdo é VISÍVEL por padrão (sem JavaScript, em capturas e para leitores de tela).
 * A animação só é armada se: há IntersectionObserver, não há "reduzir movimento"
 * e o bloco ainda está abaixo da dobra.
 */
export function Revelar({ children, as: Tag = "section", className = "", id }: { children: React.ReactNode; as?: "section" | "div"; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // já visível: não anima
    el.classList.add("pre-anima");
    const io = new IntersectionObserver(
      (ents) => {
        for (const e of ents)
          if (e.isIntersecting) {
            e.target.classList.add("anima");
            e.target.classList.remove("pre-anima");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    // garantia: se algo impedir a interseção (impressão, captura), mostra depois de 3 s
    const t = window.setTimeout(() => el.classList.remove("pre-anima"), 3000);
    const antesImprimir = () => el.classList.remove("pre-anima");
    window.addEventListener("beforeprint", antesImprimir);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
      window.removeEventListener("beforeprint", antesImprimir);
    };
  }, []);
  return (
    <Tag ref={ref as never} id={id} className={`revelar ${className}`}>
      {children}
    </Tag>
  );
}
