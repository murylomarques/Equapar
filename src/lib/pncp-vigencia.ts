/**
 * L4. Ao atualizar do PNCP, o fim da vigência só acompanha o PNCP se a pessoa não o editou.
 * "Não editou" = o fim da vigência ainda é o último valor lido do PNCP (vigenciaFimPncp).
 * Editado à mão, só guarda o valor novo do PNCP; a tela do contrato mostra os dois e deixa escolher.
 */
type Vig = { vigenciaFim: Date; vigenciaFimPncp: Date | null };

export function vigenciaAoImportar(atual: Vig, fimPncp: Date): { vigenciaFim?: Date; vigenciaFimPncp: Date } {
  const naoEditada = atual.vigenciaFimPncp && atual.vigenciaFim.getTime() === atual.vigenciaFimPncp.getTime();
  return naoEditada ? { vigenciaFim: fimPncp, vigenciaFimPncp: fimPncp } : { vigenciaFimPncp: fimPncp };
}

/** Há divergência a mostrar: o PNCP tem outra data que a registrada. */
export function divergenciaPncp(c: Vig): boolean {
  return !!c.vigenciaFimPncp && c.vigenciaFimPncp.getTime() !== c.vigenciaFim.getTime();
}
