import { Contato } from "@/components/contato";

/** A3: aviso quando o limite de demonstrações (por IP ou global) foi atingido. */
export function AvisoLimiteDemo() {
  return (
    <div className="alerta alerta-atencao mt-16" role="alert">
      <div className="alerta-corpo">
        <strong>Você já abriu demonstrações demais agora.</strong>
        <div>Tente de novo em uma hora ou fale com a gente.</div>
        <div className="mt-8">
          <Contato />
        </div>
      </div>
    </div>
  );
}
