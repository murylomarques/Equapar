/**
 * C4. Nome de aba do Excel único e válido.
 * Regras do Excel: até 31 caracteres, sem \ / * ? : [ ], sem apóstrofo nas pontas,
 * e nomes iguais sem diferenciar maiúsculas não podem se repetir.
 * `usados` guarda os nomes já usados em minúsculas (inclua "comparativo" e "retroativo").
 */
export function nomeAbaUnico(base: string, usados: Set<string>): string {
  const limpo =
    base
      .replace(/[\\/*?:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^'+|'+$/g, "")
      .trim() || "Aba";
  for (let n = 1; ; n++) {
    const sufixo = n === 1 ? "" : ` (${n})`;
    const nome = `${limpo.slice(0, 31 - sufixo.length).trimEnd()}${sufixo}`;
    if (!usados.has(nome.toLowerCase())) {
      usados.add(nome.toLowerCase());
      return nome;
    }
  }
}
