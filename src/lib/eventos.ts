import { db } from "./db";

/** Eventos de produto (Produto e experiência, Métricas). Nunca levar dado pessoal em props. */
export type NomeEvento =
  | "raiox_consultado"
  | "raiox_resultado"
  | "relatorio_pedido"
  | "conta_criada"
  | "contratos_importados"
  | "convencao_confirmada"
  | "pedido_iniciado"
  | "passo_concluido"
  | "memoria_aprovada"
  | "pedido_gerado"
  | "protocolo_registrado"
  | "resposta_registrada"
  | "diferenca_recebida"
  | "aviso_enviado"
  | "aviso_aberto"
  | "aviso_clicado";

export async function registrarEvento(nome: NomeEvento, props?: Record<string, string | number | boolean | null>) {
  try {
    await db.evento.create({ data: { nome, props: props ?? undefined } });
  } catch (e) {
    console.error("[eventos] falha ao registrar", nome, e);
  }
}
