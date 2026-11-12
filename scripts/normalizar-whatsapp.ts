/**
 * C5. Corrige números de WhatsApp já gravados para o formato internacional (+55 DDD número).
 *
 * Por padrão só SIMULA: conta quantos números mudariam e quantos são inválidos, sem gravar nada
 * e sem imprimir nenhum número (dado pessoal).
 *
 *   npx tsx --env-file=.env scripts/normalizar-whatsapp.ts            # simulação
 *   npx tsx --env-file=.env scripts/normalizar-whatsapp.ts --aplicar  # grava (só com o "ok" do dono)
 *
 * Números inválidos não são apagados: ficam como estão e aparecem na contagem para revisão.
 */
import { PrismaClient } from "@prisma/client";
import { normalizarTelefoneBR } from "../src/lib/telefone";

const db = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

async function main() {
  const usuarios = await db.usuario.findMany({ where: { whatsapp: { not: null } }, select: { id: true, whatsapp: true } });
  const leads = await db.lead.findMany({ where: { whatsapp: { not: null } }, select: { id: true, whatsapp: true } });
  const plano = (lista: { id: string; whatsapp: string | null }[]) => {
    const mudar: { id: string; novo: string }[] = [];
    let iguais = 0;
    let invalidos = 0;
    for (const x of lista) {
      const novo = normalizarTelefoneBR(x.whatsapp);
      if (!novo) invalidos++;
      else if (novo === x.whatsapp) iguais++;
      else mudar.push({ id: x.id, novo });
    }
    return { mudar, iguais, invalidos, total: lista.length };
  };
  const pu = plano(usuarios);
  const pl = plano(leads);
  console.log(aplicar ? "MODO APLICAR: gravando." : "SIMULAÇÃO: nada será gravado.");
  console.log(`Usuários com WhatsApp: ${pu.total} · já no formato: ${pu.iguais} · a corrigir: ${pu.mudar.length} · inválidos (ficam como estão): ${pu.invalidos}`);
  console.log(`Contatos do Raio-X:    ${pl.total} · já no formato: ${pl.iguais} · a corrigir: ${pl.mudar.length} · inválidos (ficam como estão): ${pl.invalidos}`);
  if (!aplicar) return;
  for (const m of pu.mudar) await db.usuario.update({ where: { id: m.id }, data: { whatsapp: m.novo } });
  for (const m of pl.mudar) await db.lead.update({ where: { id: m.id }, data: { whatsapp: m.novo } });
  console.log(`Gravado: ${pu.mudar.length} usuário(s) e ${pl.mudar.length} contato(s).`);
}

main().finally(() => db.$disconnect());
