import { AlertTriangle, Check, Clock, DollarSign, Hourglass, Stamp } from "lucide-react";
import type { Selo as TSelo, Tom } from "@/lib/prazos";

const ICONES = { relogio: Clock, carimbo: Stamp, alerta: AlertTriangle, ampulheta: Hourglass, cifrao: DollarSign, check: Check };

/** Selo de situação: sempre ícone + texto (cor nunca é o único sinal). */
export function Selo({ selo }: { selo: TSelo }) {
  const I = ICONES[selo.icone];
  return (
    <span className={`selo selo-${selo.tom}`}>
      <I size={14} strokeWidth={1.5} aria-hidden />
      {selo.texto}
    </span>
  );
}

export function SeloSimples({ texto, tom, icone = "check" }: { texto: string; tom: Tom; icone?: TSelo["icone"] }) {
  return <Selo selo={{ texto, tom, icone }} />;
}

/** Carimbo: só "PRONTO PARA PROTOCOLAR", "DEFERIDO" e "RECEBIDO". */
export function Carimbo({ texto, azul, grande }: { texto: "PRONTO PARA PROTOCOLAR" | "DEFERIDO" | "RECEBIDO"; azul?: boolean; grande?: boolean }) {
  return (
    <span className={`carimbo${azul ? " carimbo-azul" : ""}${grande ? " carimbo-g" : ""}`} role="status">
      {texto}
    </span>
  );
}
