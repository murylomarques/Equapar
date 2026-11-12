/**
 * L17. Prorrogação do contrato. Se o termo aditivo é assinado sem pedido de repactuação protocolado
 * e sem ressalva, com uma convenção nova já depositada, há risco de preclusão do direito (TCU).
 */
type ContratoPrecl = { convencao: { dataDeposito: Date | null } | null; pedidos: { estado: string; protocoloData: Date | null }[] };

export function riscoPreclusao(pr: { dataTermo: Date; comRessalva: boolean }, c: ContratoPrecl): boolean {
  if (pr.comRessalva) return false;
  const dep = c.convencao?.dataDeposito;
  if (!dep || dep > pr.dataTermo) return false;
  const protegido = c.pedidos.some((p) => !!p.protocoloData && p.protocoloData >= dep && p.protocoloData <= pr.dataTermo);
  return !protegido;
}
