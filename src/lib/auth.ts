import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import * as OTPAuth from "otpauth";
import type { Papel, Prisma } from "@prisma/client";
import { db } from "./db";
import { cifrar, decifrar, sha256, tokenAleatorio } from "./cripto";

const COOKIE = "eq_sessao";
const DURACAO_DIAS = 30;

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 12);
}

export async function conferirSenha(senha: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(senha, hash);
}

export function senhaFraca(senha: string): string | null {
  if (senha.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

// Limite simples de tentativas por chave (e-mail ou IP), em memória do processo.
const tentativas = new Map<string, { n: number; ate: number }>();
export function bloqueado(chave: string) {
  const t = tentativas.get(chave);
  return !!t && t.n >= 5 && t.ate > Date.now();
}
export function falhou(chave: string) {
  const t = tentativas.get(chave);
  const agora = Date.now();
  if (!t || t.ate < agora) tentativas.set(chave, { n: 1, ate: agora + 15 * 60_000 });
  else t.n++;
}
export function limparFalhas(chave: string) {
  tentativas.delete(chave);
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------

/**
 * Abre a sessão. Antes, remove as vencidas do usuário e a anterior do MESMO navegador
 * (o cookie atual ou o mesmo user agent), para não acumular sessões a cada login.
 * `lembrar`: 30 dias com cookie persistente; sem lembrar, 12 horas e cookie de sessão.
 */
export async function criarSessao(usuarioId: string, opts: { pendente2fa?: boolean; contaId?: string; lembrar?: boolean } = {}) {
  const token = tokenAleatorio();
  const h = await headers();
  const c = await cookies();
  const userAgent = h.get("user-agent")?.slice(0, 200) ?? null;
  const anterior = c.get(COOKIE)?.value;
  await db.sessao.deleteMany({
    where: {
      OR: [
        { usuarioId, expiraEm: { lt: new Date() } },
        ...(anterior ? [{ id: sha256(anterior) }] : []),
        ...(userAgent ? [{ usuarioId, userAgent }] : []),
      ],
    },
  });
  const contaId =
    opts.contaId ?? (await db.membro.findFirst({ where: { usuarioId }, orderBy: { criadoEm: "asc" } }))?.contaId ?? null;
  const lembrar = opts.lembrar ?? true;
  const duracaoMs = lembrar ? DURACAO_DIAS * 86_400_000 : 12 * 3_600_000;
  await db.sessao.create({
    data: {
      id: sha256(token),
      usuarioId,
      contaId,
      pendente2fa: !!opts.pendente2fa,
      userAgent,
      expiraEm: new Date(Date.now() + duracaoMs),
    },
  });
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(lembrar ? { maxAge: DURACAO_DIAS * 86_400 } : {}),
  });
}

export async function encerrarSessao() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await db.sessao.deleteMany({ where: { id: sha256(token) } });
  c.delete(COOKIE);
}

export const sessaoAtual = cache(async () => {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.sessao.findUnique({ where: { id: sha256(token) }, include: { usuario: true } });
  if (!s || s.expiraEm < new Date()) return null;
  return s;
});

export async function idSessaoAtual() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  return token ? sha256(token) : null;
}

// ---------------------------------------------------------------------------
// Contexto e permissões
// ---------------------------------------------------------------------------

export type Acao =
  | "ver"
  | "editar_contratos"
  | "editar_pedidos"
  | "aprovar_memoria"
  | "registrar_financeiro"
  | "gerenciar_conta";

const PERMISSOES: Record<Papel, Acao[]> = {
  DONO: ["ver", "editar_contratos", "editar_pedidos", "aprovar_memoria", "registrar_financeiro", "gerenciar_conta"],
  GERENTE: ["ver", "editar_contratos", "editar_pedidos", "registrar_financeiro"],
  CONTADOR: ["ver", "editar_pedidos", "aprovar_memoria"],
  LEITURA: ["ver"],
};

export const NOME_PAPEL: Record<Papel, string> = {
  DONO: "Dono",
  GERENTE: "Gerente de contratos",
  CONTADOR: "Contador",
  LEITURA: "Leitura",
};

export function pode(papel: Papel, acao: Acao) {
  return PERMISSOES[papel].includes(acao);
}

export const contexto = cache(async () => {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (s.pendente2fa) redirect("/entrar/2fa");
  const membro = s.contaId
    ? await db.membro.findUnique({ where: { usuarioId_contaId: { usuarioId: s.usuarioId, contaId: s.contaId } }, include: { conta: true } })
    : null;
  if (!membro) redirect("/criar-conta?etapa=empresa");
  const empresas = await db.empresa.findMany({ where: { contaId: membro.contaId }, orderBy: { razaoSocial: "asc" } });
  const empresaSelecionada = membro.conta.tipo === "ASSESSORIA" ? empresas.find((e) => e.id === s.empresaId) ?? null : empresas[0] ?? null;
  return {
    sessaoId: s.id,
    usuario: s.usuario,
    conta: membro.conta,
    papel: membro.papel,
    empresas,
    empresaSelecionada,
    /** Assessoria em "Todos os clientes" = null */
    empresaId: empresaSelecionada?.id ?? null,
  };
});

export type Contexto = Awaited<ReturnType<typeof contexto>>;

export async function exigir(acao: Acao) {
  const ctx = await contexto();
  if (!pode(ctx.papel, acao)) throw new Error("Seu papel nesta conta não permite esta ação.");
  return ctx;
}

/** Filtro de contratos visíveis no contexto (conta + empresa selecionada). */
export function escopoContratos(ctx: Contexto): Prisma.ContratoWhereInput {
  return {
    arquivado: false,
    empresa: { contaId: ctx.conta.id, ...(ctx.empresaId ? { id: ctx.empresaId } : {}) },
  };
}

/** Garante que o contrato pertence à conta; devolve o contrato ou lança. */
export async function contratoDaConta(ctx: Contexto, contratoId: string) {
  const c = await db.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: ctx.conta.id } }, include: { empresa: true, convencao: true } });
  if (!c) throw new Error("Contrato não encontrado nesta conta.");
  return c;
}

export async function pedidoDaConta(ctx: Contexto, pedidoId: string) {
  const p = await db.pedido.findFirst({
    where: { id: pedidoId, contrato: { empresa: { contaId: ctx.conta.id } } },
    include: { contrato: { include: { empresa: true, convencao: true } }, convencao: true },
  });
  if (!p) throw new Error("Pedido não encontrado nesta conta.");
  return p;
}

export async function registrarHistorico(
  ctx: Pick<Contexto, "conta" | "usuario">,
  acao: string,
  extra: { contratoId?: string; pedidoId?: string; detalhe?: string } = {},
) {
  await db.historico.create({
    data: { contaId: ctx.conta.id, usuarioId: ctx.usuario.id, acao, ...extra },
  });
}

// ---------------------------------------------------------------------------
// Verificação em duas etapas (TOTP)
// ---------------------------------------------------------------------------

export function novoTotp(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: "Equapar", label: email, secret, digits: 6, period: 30 });
  return { segredoCifrado: cifrar(secret.base32), uri: totp.toString() };
}

export function conferirTotp(segredoCifrado: string, codigo: string) {
  const totp = new OTPAuth.TOTP({ issuer: "Equapar", secret: OTPAuth.Secret.fromBase32(decifrar(segredoCifrado)), digits: 6, period: 30 });
  return totp.validate({ token: codigo.replace(/\D/g, ""), window: 1 }) !== null;
}
