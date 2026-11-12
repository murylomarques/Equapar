import { ArrowRight } from "lucide-react";
import { brl, dec, pct } from "@/lib/calculo/motor";

/** "R$ 1.740,00 → R$ 1.820,00 · +R$ 80,00 (+4,6%)" — cor só no delta. */
export function Comparacao({ antes, agora, compacta }: { antes: string; agora: string; compacta?: boolean }) {
  const a = dec(antes);
  const n = dec(agora);
  const d = n.minus(a);
  const p = a.isZero() ? null : d.div(a).times(100).toDecimalPlaces(1);
  const sinal = d.isPositive() && !d.isZero() ? "+" : "";
  return (
    <span className="comparacao">
      {!compacta && <span className="secundario">Antes</span>}
      <span>{brl(a)}</span>
      <ArrowRight size={14} strokeWidth={1.5} className="seta" aria-label="para" />
      {!compacta && <span className="secundario">Agora</span>}
      <span>{brl(n)}</span>
      {!d.isZero() && (
        <span className={d.isNegative() ? "delta-menos" : "delta-mais"}>
          · {sinal}
          {brl(d)}
          {p && ` (${sinal}${pct(p.toString()).replace(/,?0+%$/, "%")})`}
        </span>
      )}
    </span>
  );
}
