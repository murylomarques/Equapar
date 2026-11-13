import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { EMAIL_DEMO, EMAIL_DEMO_ASSESSORIA } from "./site";

/** C6.2: cada visitante da demonstração ganha uma cópia própria dos dados fictícios, por 4 horas. */
export const DURACAO_DEMO_MS = 4 * 3_600_000;
export const LIMITE_ARQUIVO_DEMO = 2 * 1024 * 1024;

const json = (v: Prisma.JsonValue | null) => (v === null ? undefined : (v as Prisma.InputJsonValue));
function sem<T extends Record<string, unknown>, K extends keyof T>(o: T, ...chaves: K[]): Omit<T, K> {
  const c = { ...o };
  for (const k of chaves) delete c[k];
  return c;
}

/** Conta modelo: a conta fictícia do seed (empresa: a da demonstração compartilhada; 5.2: assessoria com vários clientes). */
async function contaModelo(tipo: "EMPRESA" | "ASSESSORIA") {
  const u = await db.usuario.findUnique({ where: { email: tipo === "ASSESSORIA" ? EMAIL_DEMO_ASSESSORIA : EMAIL_DEMO }, include: { membros: true } });
  return u?.membros[0]?.contaId ?? null;
}

/** Copia a conta modelo para um visitante e devolve o usuário e a conta novos. */
export async function criarContaDemo(tipo: "EMPRESA" | "ASSESSORIA" = "EMPRESA") {
  const modeloId = await contaModelo(tipo);
  if (!modeloId) return null;
  const m = await db.conta.findUniqueOrThrow({
    where: { id: modeloId },
    include: { empresas: { include: { contratos: { include: { pedidos: true } } } }, convencoes: true, tarefas: true },
  });
  const sufixo = crypto.randomBytes(6).toString("hex");
  return db.$transaction(
    async (tx) => {
      const conta = await tx.conta.create({
        data: {
          ...sem(m, "id", "criadoEm", "empresas", "convencoes", "tarefas", "marcaLogo"),
          nome: m.nome,
          demo: true,
          demoExpiraEm: new Date(Date.now() + DURACAO_DEMO_MS),
        } as Prisma.ContaUncheckedCreateInput,
      });
      const usuario = await tx.usuario.create({
        data: { nome: "Visitante (demonstração)", email: `visitante-${sufixo}@demo.equapar.local`, membros: { create: { contaId: conta.id, papel: "DONO" } } },
      });
      const conv = new Map<string, string>();
      for (const c of m.convencoes) {
        const n = await tx.convencao.create({ data: { ...sem(c, "id", "criadoEm"), contaId: conta.id } });
        conv.set(c.id, n.id);
      }
      const contr = new Map<string, string>();
      for (const e of m.empresas) {
        const ne = await tx.empresa.create({ data: { ...sem(e, "id", "criadoEm", "contratos"), contaId: conta.id } });
        for (const c of e.contratos) {
          const nc = await tx.contrato.create({
            data: { ...sem(c, "id", "criadoEm", "pedidos"), empresaId: ne.id, convencaoId: c.convencaoId ? (conv.get(c.convencaoId) ?? null) : null },
          });
          contr.set(c.id, nc.id);
          for (const p of c.pedidos) {
            await tx.pedido.create({
              data: {
                ...sem(p, "id", "criadoEm", "atualizadoEm"),
                contratoId: nc.id,
                convencaoId: p.convencaoId ? (conv.get(p.convencaoId) ?? null) : null,
                planilhaAntes: json(p.planilhaAntes),
                planilhaAgora: json(p.planilhaAgora),
                linhasNaoLidas: json(p.linhasNaoLidas),
                checklist: json(p.checklist),
              } as Prisma.PedidoUncheckedCreateInput,
            });
          }
        }
      }
      for (const t of m.tarefas) {
        await tx.tarefa.create({ data: { ...sem(t, "id", "criadoEm"), contaId: conta.id, contratoId: t.contratoId ? (contr.get(t.contratoId) ?? null) : null } as Prisma.TarefaUncheckedCreateInput });
      }
      return { usuario, conta };
    },
    { timeout: 30_000 },
  );
}

/**
 * 5.4: pedido pronto de exemplo (dados fictícios da conta modelo da demonstração), para quem monta o
 * primeiro pedido ver o resultado sem sair da própria conta. Só leitura.
 */
export async function pedidoExemplo() {
  const modeloId = await contaModelo("EMPRESA");
  if (!modeloId) return null;
  return db.pedido.findFirst({
    where: { contrato: { empresa: { contaId: modeloId, exemplo: true } }, estado: { in: ["PROTOCOLADO", "DEFERIDO"] } },
    include: { contrato: true, convencao: true },
    orderBy: { criadoEm: "asc" },
  });
}
