"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Papel, Plano } from "@prisma/client";
import { conferirSenha, conferirTotp, contexto, encerrarSessao, exigir, hashSenha, novoTotp, registrarHistorico, senhaFraca } from "@/lib/auth";
import { db } from "@/lib/db";
import { tentar, texto, type Resultado } from "@/lib/acao";
import { tokenAleatorio } from "@/lib/cripto";
import { appUrl, enviar } from "@/lib/mensagens";
import { rodarAvisos } from "@/lib/avisos";
import { apagarPastaConta } from "@/lib/storage";
import { EMAIL_DEMO } from "@/lib/site";

export async function salvarConta(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    const nome = texto(fd, "nome");
    if (!nome) return { erro: "Informe o nome da conta." };
    const cor = texto(fd, "marcaCor");
    if (cor && !/^#[0-9a-f]{6}$/i.test(cor)) return { erro: "Cor inválida. Use o formato #1E7A55." };
    await db.conta.update({
      where: { id: ctx.conta.id },
      data: { nome, marcaNome: texto(fd, "marcaNome") || null, marcaCor: cor || null, mostrarValoresWhatsapp: fd.get("mostrarValoresWhatsapp") === "on" },
    });
    await registrarHistorico(ctx, "Alterou os dados da conta");
    revalidatePath("/app", "layout");
    return { ok: "Salvo." };
  });
}

export async function salvarAvisos(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    const canal = z.enum(["EMAIL", "WHATSAPP", "AMBOS"]);
    const prefs = {
      prazo: canal.parse(texto(fd, "prazo") || "AMBOS"),
      resposta: canal.parse(texto(fd, "resposta") || "EMAIL"),
      deferido: canal.parse(texto(fd, "deferido") || "AMBOS"),
      semanal: fd.get("semanal") === "on",
      hora: Math.min(23, Math.max(0, Number(texto(fd, "hora")) || 7)),
    };
    const whats = texto(fd, "whatsapp").replace(/\D/g, "");
    if (whats && (whats.length < 10 || whats.length > 13)) return { erro: "Confira o WhatsApp: use DDD e número." };
    const consent = fd.get("consentimento") === "on";
    if (whats && !consent) return { erro: "Para receber avisos no WhatsApp, marque a autorização." };
    await db.usuario.update({
      where: { id: ctx.usuario.id },
      data: {
        prefsAvisos: prefs,
        whatsapp: whats || null,
        whatsappConsentEm: whats && consent ? ctx.usuario.whatsappConsentEm ?? new Date() : null,
      },
    });
    revalidatePath("/app/configuracoes");
    return { ok: "Preferências de aviso salvas." };
  });
}

export async function convidarPessoa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    const email = texto(fd, "email").toLowerCase();
    const nome = texto(fd, "nome");
    const papel = z.enum(["DONO", "GERENTE", "CONTADOR", "LEITURA"]).parse(texto(fd, "papel")) as Papel;
    if (!z.string().email().safeParse(email).success) return { erro: "Confira o e-mail." };
    if (!nome) return { erro: "Informe o nome." };
    let u = await db.usuario.findUnique({ where: { email } });
    let senhaTemporaria: string | null = null;
    if (!u) {
      senhaTemporaria = `${tokenAleatorio(6)}9a`;
      u = await db.usuario.create({ data: { nome, email, senhaHash: await hashSenha(senhaTemporaria) } });
    }
    const ja = await db.membro.findUnique({ where: { usuarioId_contaId: { usuarioId: u.id, contaId: ctx.conta.id } } });
    if (ja) return { erro: "Esta pessoa já está na conta." };
    await db.membro.create({ data: { usuarioId: u.id, contaId: ctx.conta.id, papel } });
    await enviar({
      contaId: ctx.conta.id,
      chave: `CONVITE:${ctx.conta.id}:${u.id}`,
      tipo: "CONVITE",
      canal: "EMAIL",
      destino: email,
      assunto: `${ctx.usuario.nome} convidou você para a Equapar`,
      corpo: `${ctx.usuario.nome} adicionou você à conta ${ctx.conta.nome} na Equapar. Entre em ${appUrl("/entrar")}${senhaTemporaria ? " com a senha temporária que você vai receber de quem convidou, e troque-a em Configurações > Segurança." : "."}`,
    });
    await registrarHistorico(ctx, `Adicionou ${nome} (${papel.toLowerCase()})`);
    revalidatePath("/app/configuracoes");
    return { ok: senhaTemporaria ? `Pessoa adicionada. Senha temporária (mostrada só agora): ${senhaTemporaria}` : "Pessoa adicionada." };
  });
}

export async function mudarPapel(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    const membroId = texto(fd, "membroId");
    const papel = z.enum(["DONO", "GERENTE", "CONTADOR", "LEITURA"]).parse(texto(fd, "papel")) as Papel;
    const m = await db.membro.findFirst({ where: { id: membroId, contaId: ctx.conta.id } });
    if (!m) return { erro: "Pessoa não encontrada." };
    if (m.papel === "DONO" && papel !== "DONO" && (await db.membro.count({ where: { contaId: ctx.conta.id, papel: "DONO" } })) === 1)
      return { erro: "A conta precisa de pelo menos um Dono." };
    await db.membro.update({ where: { id: m.id }, data: { papel } });
    revalidatePath("/app/configuracoes");
    return { ok: "Papel alterado." };
  });
}

export async function removerPessoa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    const m = await db.membro.findFirst({ where: { id: texto(fd, "membroId"), contaId: ctx.conta.id } });
    if (!m) return { erro: "Pessoa não encontrada." };
    if (m.usuarioId === ctx.usuario.id) return { erro: "Você não pode remover a si mesmo." };
    if (m.papel === "DONO" && (await db.membro.count({ where: { contaId: ctx.conta.id, papel: "DONO" } })) === 1) return { erro: "A conta precisa de pelo menos um Dono." };
    await db.membro.delete({ where: { id: m.id } });
    await db.sessao.updateMany({ where: { usuarioId: m.usuarioId, contaId: ctx.conta.id }, data: { contaId: null } });
    revalidatePath("/app/configuracoes");
    return { ok: "Pessoa removida." };
  });
}

export async function mudarPlano(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    const plano = z.enum(["GRATIS", "PILOTO", "CARTEIRA", "ASSESSORIA"]).parse(texto(fd, "plano")) as Plano;
    await db.conta.update({ where: { id: ctx.conta.id }, data: { plano, pilotoInicio: plano === "PILOTO" ? new Date() : ctx.conta.pilotoInicio } });
    await registrarHistorico(ctx, `Mudou o plano para ${plano.toLowerCase()}`);
    revalidatePath("/app", "layout");
    return { ok: plano === "GRATIS" ? "Assinatura cancelada. Seus dados continuam disponíveis para exportar." : "Plano alterado." };
  });
}

export async function trocarSenha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    const atual = String(fd.get("atual") ?? "");
    const nova = String(fd.get("nova") ?? "");
    if (ctx.usuario.senhaHash && !(await conferirSenha(atual, ctx.usuario.senhaHash))) return { erro: "A senha atual não confere." };
    const fraca = senhaFraca(nova);
    if (fraca) return { erro: fraca };
    await db.usuario.update({ where: { id: ctx.usuario.id }, data: { senhaHash: await hashSenha(nova) } });
    await db.sessao.deleteMany({ where: { usuarioId: ctx.usuario.id, id: { not: ctx.sessaoId } } });
    return { ok: "Senha trocada. As outras sessões foram encerradas." };
  });
}

export async function iniciar2fa(): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    const { segredoCifrado, uri } = novoTotp(ctx.usuario.email);
    await db.usuario.update({ where: { id: ctx.usuario.id }, data: { totpSegredoCifrado: segredoCifrado, totpAtivo: false } });
    const QR = await import("qrcode");
    const svg = await QR.toString(uri, { type: "svg", margin: 1, width: 200 });
    return { ok: "Leia o código no aplicativo autenticador e confirme abaixo.", dados: { svg, uri } };
  });
}

export async function confirmar2faConfig(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    const u = await db.usuario.findUnique({ where: { id: ctx.usuario.id } });
    if (!u?.totpSegredoCifrado) return { erro: "Comece a configuração de novo." };
    if (!conferirTotp(u.totpSegredoCifrado, texto(fd, "codigo"))) return { erro: "Código não confere. Confira o relógio do celular e tente o código atual." };
    await db.usuario.update({ where: { id: u.id }, data: { totpAtivo: true } });
    revalidatePath("/app/configuracoes");
    return { ok: "Verificação em duas etapas ativada." };
  });
}

export async function desativar2fa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    const u = await db.usuario.findUnique({ where: { id: ctx.usuario.id } });
    if (!u?.totpSegredoCifrado || !conferirTotp(u.totpSegredoCifrado, texto(fd, "codigo"))) return { erro: "Para desativar, digite o código atual do aplicativo." };
    await db.usuario.update({ where: { id: u.id }, data: { totpAtivo: false, totpSegredoCifrado: null } });
    revalidatePath("/app/configuracoes");
    return { ok: "Verificação em duas etapas desativada." };
  });
}

export async function encerrarOutraSessao(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async () => {
    const ctx = await contexto();
    await db.sessao.deleteMany({ where: { id: texto(fd, "sessaoId"), usuarioId: ctx.usuario.id } });
    revalidatePath("/app/configuracoes");
    return { ok: "Sessão encerrada." };
  });
}

export async function excluirConta(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async () => {
    const ctx = await exigir("gerenciar_conta");
    if (texto(fd, "confirmacao") !== "EXCLUIR") return { erro: "Digite EXCLUIR para confirmar." };
    const membros = await db.membro.findMany({ where: { contaId: ctx.conta.id } });
    await apagarPastaConta(ctx.conta.id);
    await db.conta.delete({ where: { id: ctx.conta.id } });
    for (const m of membros) {
      const outras = await db.membro.count({ where: { usuarioId: m.usuarioId } });
      if (outras === 0) await db.usuario.delete({ where: { id: m.usuarioId } });
    }
  });
  if (r.erro) return r;
  await encerrarSessao();
  redirect("/?conta=excluida");
}

export async function rodarAvisosAgora(): Promise<Resultado> {
  return tentar(async () => {
    await exigir("gerenciar_conta");
    const r = await rodarAvisos();
    revalidatePath("/app/avisos");
    return { ok: `Verificação feita: ${r.prazos} contratos com prazo, ${r.semanais} resumos semanais, ${r.apostilamento} alertas de apostilamento.` };
  });
}
