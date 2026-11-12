/**
 * L12. "Pedir revisão de especialista" fica desligado até existir o fluxo de verdade (revisor parceiro,
 * situação "Em revisão", protocolo bloqueado até concluir). Liga com REVISAO_ESPECIALISTA_ATIVA=true.
 */
export function revisaoEspecialistaAtiva() {
  return process.env.REVISAO_ESPECIALISTA_ATIVA === "true";
}
