import { Contato } from "@/components/contato";

/** Por que a demonstração não abriu: limite do visitante (IP), limite de todas as demonstrações ou conta modelo ausente. */
export type MotivoDemo = "ip" | "geral" | "indisponivel";

const TEXTOS: Record<MotivoDemo, [string, string]> = {
  ip: ["Você já abriu demonstrações demais agora.", "Tente de novo em uma hora ou fale com a gente."],
  geral: ["Muita gente está vendo a demonstração agora.", "Tente de novo mais tarde ou fale com a gente."],
  indisponivel: ["A demonstração não está disponível agora.", "Tente de novo mais tarde ou fale com a gente."],
};

/** A3: aviso quando a demonstração não pôde ser aberta, com o motivo. */
export function AvisoLimiteDemo({ motivo }: { motivo: MotivoDemo }) {
  const [titulo, texto] = TEXTOS[motivo];
  return (
    <div className="alerta alerta-atencao mt-16" role="alert">
      <div className="alerta-corpo">
        <strong>{titulo}</strong>
        <div>{texto}</div>
        <div className="mt-8">
          <Contato />
        </div>
      </div>
    </div>
  );
}

/** Lê o motivo dos parâmetros da página (?limite=ip|geral, ?indisponivel=1; o antigo ?limite=1 vale como limite do visitante). */
export function motivoDemo(sp: { limite?: string; indisponivel?: string }): MotivoDemo | null {
  if (sp.indisponivel) return "indisponivel";
  if (sp.limite === "geral") return "geral";
  return sp.limite ? "ip" : null;
}
