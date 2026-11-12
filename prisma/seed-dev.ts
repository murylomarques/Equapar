/**
 * S7. Dados de DESENVOLVIMENTO: a conta modelo fictícia (seed-demo) + o usuário Dono de teste
 * (dono@exemplo.local), com senha aleatória impressa no fim. Recusa rodar em produção.
 *
 *   npm run db:seed        (tsx --env-file=.env prisma/seed-dev.ts)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { criarModeloDemo } from "./seed-demo";

const EMAIL_DONO = "dono@exemplo.local";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("seed-dev não roda com NODE_ENV=production. Em produção, use npm run db:seed:demo (sem usuário Dono).");
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient();
  try {
    await db.usuario.deleteMany({ where: { email: EMAIL_DONO } });
    const { contaId } = await criarModeloDemo(db);
    const senhaDono = `${crypto.randomBytes(6).toString("base64url")}7x`;
    await db.usuario.create({
      data: {
        nome: "Marcos (exemplo)",
        email: EMAIL_DONO,
        senhaHash: await bcrypt.hash(senhaDono, 12),
        emailVerificadoEm: new Date(),
        membros: { create: { contaId, papel: "DONO" } },
      },
    });
    console.log("Demonstração: http://localhost:3000/demonstracao");
    console.log(`Usuário Dono para testes locais: ${EMAIL_DONO}  senha: ${senhaDono}`);
    console.log("(guarde a senha; ela não é mostrada de novo. Rode o seed outra vez para gerar outra.)");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
