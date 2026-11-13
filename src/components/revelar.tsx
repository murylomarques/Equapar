/**
 * Bloco da landing que entra com opacidade + 8 px ao rolar.
 * A5: sem JavaScript. A animação é só CSS (animation-timeline: view()), nos navegadores que suportam e
 * sem "reduzir movimento". Nada fica escondido: sem suporte, o bloco simplesmente aparece.
 */
export function Revelar({ children, as: Tag = "section", className = "", id }: { children: React.ReactNode; as?: "section" | "div"; className?: string; id?: string }) {
  return (
    <Tag id={id} className={`revelar ${className}`}>
      {children}
    </Tag>
  );
}
