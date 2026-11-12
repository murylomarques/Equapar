import type { FONTES } from "@/lib/prazos";

export function FonteRegra({ regra }: { regra: (typeof FONTES)[keyof typeof FONTES] }) {
  return (
    <p className="fonte-regra mb-0">
      {regra.texto} Fonte:{" "}
      <a href={regra.url} target="_blank" rel="noreferrer">
        {regra.fonte}
      </a>
      .
    </p>
  );
}
