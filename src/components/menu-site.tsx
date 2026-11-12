"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  ["/raio-x", "Fazer o Raio-X grátis"],
  ["/#como-funciona", "Como funciona"],
  ["/precos", "Preços"],
  ["/assessorias", "Para assessorias"],
  ["/guias", "Guias"],
] as const;

/** Menu do site no celular: painel com foco preso, fecha com Esc, ao tocar fora ou ao escolher um link. */
export function MenuSite() {
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const el = painel.current;
    const focaveis = () => [...(el?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    focaveis()[0]?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
      if (e.key === "Tab") {
        const f = focaveis();
        if (!f.length) return;
        const primeiro = f[0];
        const ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <button ref={botao} type="button" className="btn btn-icone so-celular" aria-label="Abrir menu" aria-expanded={aberto} aria-controls="menu-site" onClick={() => setAberto(true)}>
        <Menu size={20} strokeWidth={1.5} />
      </button>
      {aberto && (
        <div className="menu-site-fundo" onClick={() => setAberto(false)}>
          <div
            id="menu-site"
            ref={painel}
            className="menu-site-painel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="entre" style={{ marginBottom: 12 }}>
              <strong>Menu</strong>
              <button type="button" className="btn btn-discreto btn-icone" aria-label="Fechar menu" onClick={() => setAberto(false)}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <nav aria-label="Menu do site">
              <ul className="lista-limpa pilha-8">
                {LINKS.map(([href, nome], i) => (
                  <li key={href}>
                    <Link href={href} className={i === 0 ? "btn btn-primario" : "btn btn-discreto"} style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setAberto(false)}>
                      {nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
