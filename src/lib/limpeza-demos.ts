/**
 * A3. Limpeza das contas de demonstração (cópias dos visitantes). Só entram contas com demo = true e mais
 * de 4 horas. A conta modelo do seed (demo = false, do usuário da demonstração) nunca entra.
 * Por padrão SIMULA. No worker, roda de hora em hora só com LIMPEZA_DEMOS_AUTOMATICA=true (trava 2).
 */
import { db } from "./db";
import { armazenamento } from "./armazenamento";
import { EMAIL_DEMO, EMAIL_DEMO_ASSESSORIA } from "./site";

export const IDADE_MINIMA_MS = 4 * 3_600_000;

export function limpezaDemosLigada() {
  return process.env.LIMPEZA_DEMOS_AUTOMATICA === "true";
}

export async function limparDemos({ aplicar = false, agora = new Date() } = {}) {
  const corte = new Date(agora.getTime() - IDADE_MINIMA_MS);
  const modelos = (await db.membro.findMany({ where: { usuario: { email: { in: [EMAIL_DEMO, EMAIL_DEMO_ASSESSORIA] } } }, select: { contaId: true } })).map((m) => m.contaId);
  const alvo = await db.conta.findMany({ where: { demo: true, criadoEm: { lt: corte }, id: { notIn: modelos } }, select: { id: true, demo: true } });
  const ids = alvo.map((c) => c.id);
  const usuarios = (await db.membro.findMany({ where: { contaId: { in: ids } }, select: { usuarioId: true } })).map((m) => m.usuarioId);
  const resumo = {
    modo: aplicar ? "aplicar" : "simulacao",
    contas: ids.length,
    contratos: await db.contrato.count({ where: { empresa: { contaId: { in: ids } } } }),
    pedidos: await db.pedido.count({ where: { contrato: { empresa: { contaId: { in: ids } } } } }),
    visitantes: usuarios.length,
    // prova: nenhuma conta de cliente (demo = false) e nenhum modelo entram
    contasDeClienteNaLista: alvo.filter((c) => !c.demo).length,
    modelosNaLista: ids.filter((id) => modelos.includes(id)).length,
    contasDeClienteNoBanco: await db.conta.count({ where: { demo: false } }),
  };
  if (!aplicar) return resumo;
  const arm = await armazenamento();
  for (const id of ids) {
    await db.conta.delete({ where: { id } }); // banco primeiro (cascata)
    await arm.apagarPrefixo(`${id}/`).catch(() => {}); // arquivos depois
  }
  await db.usuario.deleteMany({ where: { id: { in: usuarios }, email: { endsWith: "@demo.equapar.local" } } });
  return resumo;
}
