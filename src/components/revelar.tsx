"use client";
import { useEffect, useRef } from "react";

/** Bloco da landing aparece uma vez ao rolar (200 ms, opacidade + 8 px). */
export function Revelar({ children, as: Tag = "section", className = "", id }: { children: React.ReactNode; as?: "section" | "div"; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("visivel");
      return;
    }
    const io = new IntersectionObserver(
      (ents) => {
        for (const e of ents)
          if (e.isIntersecting) {
            e.target.classList.add("visivel");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -10% 0px" },
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
