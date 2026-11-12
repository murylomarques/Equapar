"use client";
import { useEffect, useRef } from "react";

/**
 * Bloco da landing que entra com opacidade + 8 px, uma vez, ao rolar.
 * Nada fica escondido: o conteúdo é visível sem JavaScript, em capturas de página inteira,
 * na impressão e para leitores de tela. A animação só dispara quando o bloco está prestes
 * a entrar na tela (120 px antes), por isso ela roda enquanto ele aparece.
 * Não anima: blocos já visíveis ao carregar, sem IntersectionObserver ou com "reduzir movimento".
 */
export function Revelar({ children, as: Tag = "section", className = "", id }: { children: React.ReactNode; as?: "section" | "div"; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const io = new IntersectionObserver(
      (ents) => {
        for (const e of ents)
          if (e.isIntersecting) {
            e.target.classList.add("entrando");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px 120px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} id={id} className={`revelar ${className}`}>
      {children}
    </Tag>
  );
}
