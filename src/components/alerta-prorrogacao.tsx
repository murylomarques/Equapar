import { Alerta } from "@/components/ui/estrutura";
import type { AlertaProrrogacao } from "@/lib/prorrogacao";

/** C5 (e D6): alerta de prorrogação com o grau ao lado e o "por quê" com a fonte. */
export function AlertaDeProrrogacao({ alerta, fonte }: { alerta: AlertaProrrogacao; fonte: { texto: string; url: string; fonte: string } }) {
  const tipo = alerta.grau === "Confirmado" ? "erro" : "atencao";
  return (
    <Alerta tipo={tipo} className="mb-16" titulo={<>{alerta.mensagem} <span className={`selo ${alerta.grau === "Confirmado" ? "selo-carimbo" : "selo-ambar"}`}>{alerta.grau}</span></>}>
      <details>
        <summary style={{ cursor: "pointer" }}>Ver por quê</summary>
        <p className="mt-8 mb-0">
          {alerta.porQue} {fonte.texto} Fonte:{" "}
          <a href={fonte.url} target="_blank" rel="noopener noreferrer">
            {fonte.fonte}
          </a>
          .
        </p>
      </details>
    </Alerta>
  );
}
