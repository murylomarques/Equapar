/**
 * Ajustes de dados aprovados no redesenho (opções 2 e 2):
 *  - varia os valores mensais dos contratos de EXEMPLO (só empresas marcadas como fictícias), sem apagar nada;
 *  - remove sessões vencidas ou duplicadas (mesmo navegador) só das contas fictícias de exemplo e demonstração.
 * Uso: npx tsx scripts/ajustes-redesenho.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const CONTAS_FICTICIAS = ["dono@exemplo.local", "demonstracao@equapar.local"];

// número do contrato → valor mensal e postos (fictícios). 12/2024 e 07/2025 seguem a planilha dos pedidos de exemplo.
const VALORES: Record<string, { valorMensal: string; postos: number | null }> = {
  "45/2025": { valorMensal: "58805.66", postos: 11 },
  "12/2024": { valorMensal: "58805.66", postos: 11 },
  "07/2025": { valorMensal: "62070.27", postos: 11 }, // já apostilado: valor novo
  "03/2025": { valorMensal: "27410.00", postos: null },
  "19/2025": { valorMensal: "21876.40", postos: 4 },
};

async function main() {
  let contratos = 0;
  for (const [numero, v] of Object.entries(VALORES)) {
    const r = await db.contrato.updateMany({ where: { numero, empresa: { exemplo: true } }, data: v });
    contratos += r.count;
  }

  const usuarios = await db.usuario.findMany({ where: { email: { in: CONTAS_FICTICIAS } }, select: { id: true, email: true } });
  let vencidas = 0;
  let duplicadas = 0;
  for (const u of usuarios) {
    vencidas += (await db.sessao.deleteMany({ where: { usuarioId: u.id, expiraEm: { lt: new Date() } } })).count;
    const sessoes = await db.sessao.findMany({ where: { usuarioId: u.id }, orderBy: { vistoEm: "desc" } });
    const vistos = new Set<string>();
    const apagar: string[] = [];
    for (const s of sessoes) {
      const chave = s.userAgent ?? "";
      if (vistos.has(chave)) apagar.push(s.id);
      else vistos.add(chave);
    }
    duplicadas += (await db.sessao.deleteMany({ where: { id: { in: apagar } } })).count;
  }
  console.log(JSON.stringify({ contratosAtualizados: contratos, sessoesVencidasRemovidas: vencidas, sessoesDuplicadasRemovidas: duplicadas }));
}

main().finally(() => db.$disconnect());
