import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  ["/raio-x", "Fazer o Raio-X grátis"],
  ["/#como-funciona", "Como funciona"],
  ["/precos", "Preços"],
  ["/assessorias", "Para assessorias"],
  ["/guias", "Guias"],
] as const;

/**
 * Menu do site no celular. A5: sem JavaScript, com <details> nativo (abre e fecha pelo teclado e pelo toque).
 * `ocultar` tira links escondidos por chave (ex.: modo piloto).
 */
export function MenuSite({ ocultar = [] }: { ocultar?: string[] }) {
  const links = LINKS.filter(([href]) => !ocultar.includes(href));
  return (
    <details className="menu-site so-celular">
      <summary className="btn btn-icone" aria-label="Menu">
        <Menu size={20} strokeWidth={1.5} className="icone-abrir" aria-hidden />
        <X size={20} strokeWidth={1.5} className="icone-fechar" aria-hidden />
      </summary>
      <nav aria-label="Menu do site" className="menu-site-painel">
        <ul className="lista-limpa pilha-8">
          {links.map(([href, nome], i) => (
            <li key={href}>
              <Link href={href} className={i === 0 ? "btn btn-primario" : "btn btn-discreto"} style={{ width: "100%", justifyContent: "flex-start" }}>
                {nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
