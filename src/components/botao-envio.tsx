"use client";
import { useFormStatus } from "react-dom";

export function BotaoEnvio({ children, className = "btn btn-primario", pendente = "Aguarde…", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending ? pendente : children}
    </button>
  );
}
