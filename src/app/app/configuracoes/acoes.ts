"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Papel, Plano } from "@prisma/client";
import { conferirSenha, conferirTotp, exigirUsuario, encerrarSessao, exigir, hashSenha, novoTotp, registrarHistorico, senhaFraca } from "@/lib/auth";
import { db } from "@/lib/db";
import { tentar, texto, type Resultado } from "@/lib/acao";
import { appUrl, enviar } from "@/lib/mensagens";
import { rodarAvisos } from "@/lib/avisos";
import { apagarPastaConta } from "@/lib/storage";
import { EMAIL_DEMO } from "@/lib/site";
import { normalizarTelefoneBR } from "@/lib/telefone";
import { gerarCodigosRecuperacao } from "@/lib/recuperacao";
import { tokenConvite } from "@/lib/convite";

export async function salvarConta(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
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
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    const canal = z.enum(["EMAIL", "WHATSAPP", "AMBOS"]);
    const prefs = {
      prazo: canal.parse(texto(fd, "prazo") || "AMBOS"),
      resposta: canal.parse(texto(fd, "resposta") || "EMAIL"),
      deferido: canal.parse(texto(fd, "deferido") || "AMBOS"),
      semanal: fd.get("semanal") === "on",
      hora: Math.min(23, Math.max(0, Number(texto(fd, "hora")) || 7)),
    };
    // C5: grava no formato internacional (+55 DDD número), o que a Meta exige
    const bruto = texto(fd, "whatsapp");
    const whats = bruto ? normalizarTelefoneBR(bruto) : null;
    if (bruto && !whats) return { campos: { whatsapp: "Digite o WhatsApp com DDD, por exemplo (27) 99999-0000." } };
    const consent = fd.get("consentimento") === "on";
    if (whats && !consent) return { campos: { consentimento: "Para receber avisos no WhatsApp, marque a autorização." } };
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
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    const email = texto(fd, "email").toLowerCase();
    const nome = texto(fd, "nome");
    const papel = z.enum(["DONO", "GERENTE", "CONTADOR", "LEITURA"]).parse(texto(fd, "papel")) as Papel;
    const campos: Record<string, string> = {};
    if (!nome) campos.nome = "Digite o nome da pessoa.";
    if (!z.string().email().safeParse(email).success) campos.email = "Digite um e-mail válido, como nome@empresa.com.br.";
    if (Object.keys(campos).length) return { campos };
    // S12: quem não tem conta é criado SEM senha e recebe um link (7 dias) para definir a própria
    let u = await db.usuario.findUnique({ where: { email } });
    const nova = !u;
    if (!u) u = await db.usuario.create({ data: { nome, email } });
    const ja = await db.membro.findUnique({ where: { usuarioId_contaId: { usuarioId: u.id, contaId: ctx.conta.id } } });
    if (ja) return { erro: "Esta pessoa já está na conta." };
    await db.membro.create({ data: { usuarioId: u.id, contaId: ctx.conta.id, papel } });
    const precisaSenha = nova || !u.senhaHash;
    const link = precisaSenha ? appUrl(`/convite?t=${encodeURIComponent(tokenConvite(u, ctx.conta.id))}`) : appUrl("/entrar");
    await enviar({
      contaId: ctx.conta.id,
      chave: `CONVITE:${ctx.conta.id}:${u.id}:${Date.now()}`,
      tipo: "CONVITE",
      canal: "EMAIL",
      destino: email,
      assunto: `${ctx.usuario.nome} convidou você para a Equapar`,
      corpo: precisaSenha
        ? `${ctx.usuario.nome} convidou você para a conta ${ctx.conta.nome} na Equapar. Para entrar, crie a sua senha neste link, que vale por 7 dias: ${link}`
        : `${ctx.usuario.nome} adicionou você à conta ${ctx.conta.nome} na Equapar. Entre com o seu e-mail e a sua senha em ${link}.`,
    });
    await registrarHistorico(ctx, `Convidou ${nome} (${papel.toLowerCase()})`);
    revalidatePath("/app/configuracoes");
    return { ok: precisaSenha ? `Convite enviado para ${email}. O link vale por 7 dias.` : `${nome} foi adicionada à conta e recebeu um aviso por e-mail.` };
  });
}

export async function mudarPapel(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
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
  return tentar(async (): Promise<Resultado | void> => {
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
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    const plano = z.enum(["GRATIS", "PILOTO", "CARTEIRA", "ASSESSORIA"]).parse(texto(fd, "plano")) as Plano;
    await db.conta.update({ where: { id: ctx.conta.id }, data: { plano, pilotoInicio: plano === "PILOTO" ? new Date() : ctx.conta.pilotoInicio } });
    await registrarHistorico(ctx, `Mudou o plano para ${plano.toLowerCase()}`);
    revalidatePath("/app", "layout");
    return { ok: plano === "GRATIS" ? "Assinatura cancelada. Seus dados continuam disponíveis para exportar." : "Plano alterado." };
  });
}

export async function trocarSenha(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    const atual = String(fd.get("atual") ?? "");
    const nova = String(fd.get("nova") ?? "");
    if (ctx.usuario.senhaHash && !(await conferirSenha(atual, ctx.usuario.senhaHash))) return { erro: "A senha atual não confere." };
    const fraca = senhaFraca(nova, { duasEtapas: ctx.usuario.totpAtivo, email: ctx.usuario.email });
    if (fraca) return { erro: fraca };
    await db.usuario.update({ where: { id: ctx.usuario.id }, data: { senhaHash: await hashSenha(nova) } });
    await db.sessao.deleteMany({ where: { usuarioId: ctx.usuario.id, id: { not: ctx.sessaoId } } });
    return { ok: "Senha trocada. As outras sessões foram encerradas." };
  });
}

/**
 * C8. Começa a configurar (ou trocar) o aplicativo autenticador. Com as duas etapas ativas, exige o
 * código atual ou a senha. O segredo novo fica pendente: o atual continua valendo até a confirmação.
 */
export async function iniciar2fa(_?: Resultado, fd?: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    if (ctx.usuario.email === EMAIL_DEMO) return { erro: "A demonstração é só para leitura." };
    if (ctx.usuario.totpAtivo) {
      const codigo = fd ? texto(fd, "codigo") : "";
      const senha = fd ? String(fd.get("senha") ?? "") : "";
      const okCodigo = !!codigo && !!ctx.usuario.totpSegredoCifrado && conferirTotp(ctx.usuario.totpSegredoCifrado, codigo);
      const okSenha = !okCodigo && !!senha && (await conferirSenha(senha, ctx.usuario.senhaHash));
      if (!okCodigo && !okSenha) return { erro: "Para trocar o aplicativo, digite o código atual do aplicativo ou a sua senha." };
    }
    const { segredoCifrado, uri } = novoTotp(ctx.usuario.email);
    await db.usuario.update({ where: { id: ctx.usuario.id }, data: { totpSegredoPendente: segredoCifrado } });
    const QR = await import("qrcode");
    const svg = await QR.toString(uri, { type: "svg", margin: 1, width: 200 });
    return { ok: "Leia o código no aplicativo autenticador e confirme abaixo.", dados: { svg, uri } };
  });
}

export async function confirmar2faConfig(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    const u = await db.usuario.findUnique({ where: { id: ctx.usuario.id } });
    if (!u?.totpSegredoPendente) return { erro: "Comece a configuração de novo." };
    if (!conferirTotp(u.totpSegredoPendente, texto(fd, "codigo"))) return { erro: "Código não confere. Confira o relógio do celular e tente o código atual." };
    const { codigos, hashes } = gerarCodigosRecuperacao();
    await db.usuario.update({
      where: { id: u.id },
      data: { totpSegredoCifrado: u.totpSegredoPendente, totpSegredoPendente: null, totpAtivo: true, codigosRecuperacao: hashes },
    });
    revalidatePath("/app/configuracoes");
    return { ok: "Verificação em duas etapas ativada. Guarde os códigos de recuperação.", dados: { codigos } };
  });
}

export async function desativar2fa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    const u = await db.usuario.findUnique({ where: { id: ctx.usuario.id } });
    if (!u?.totpSegredoCifrado || !conferirTotp(u.totpSegredoCifrado, texto(fd, "codigo"))) return { erro: "Para desativar, digite o código atual do aplicativo." };
    await db.usuario.update({ where: { id: u.id }, data: { totpAtivo: false, totpSegredoCifrado: null, totpSegredoPendente: null, codigosRecuperacao: [] } });
    revalidatePath("/app/configuracoes");
    return { ok: "Verificação em duas etapas desativada." };
  });
}

export async function encerrarOutraSessao(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    await db.sessao.deleteMany({ where: { id: texto(fd, "sessaoId"), usuarioId: ctx.usuario.id } });
    revalidatePath("/app/configuracoes");
    return { ok: "Sessão encerrada." };
  });
}

export async function excluirConta(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    if (texto(fd, "confirmacao") !== "EXCLUIR") return { campos: { confirmacao: "Digite EXCLUIR, em maiúsculas, para confirmar." } };
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
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    const r = await rodarAvisos({ contaId: ctx.conta.id });
    revalidatePath("/app/avisos");
    return { ok: `Verificação feita nesta conta: ${r.prazos} contratos com prazo, ${r.semanais} resumos semanais, ${r.apostilamento} alertas de apostilamento.` };
  });
}

export async function encerrarOutrasSessoes(): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigirUsuario();
    const r = await db.sessao.deleteMany({ where: { usuarioId: ctx.usuario.id, id: { not: ctx.sessaoId } } });
    revalidatePath("/app/configuracoes");
    return { ok: r.count ? `${r.count === 1 ? "1 sessão encerrada" : `${r.count} sessões encerradas`}.` : "Não havia outras sessões abertas." };
  });
}

/** "Exportar tudo" em segundo plano: avisa no sino quando terminar. */
export async function exportarEmFundo(): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    const rodando = await db.trabalhoFundo.findFirst({ where: { contaId: ctx.conta.id, tipo: "EXPORTAR", status: "RODANDO" } });
    if (rodando) return { ok: "A exportação já está em andamento. Avisamos no sino quando terminar." };
    const t = await db.trabalhoFundo.create({ data: { contaId: ctx.conta.id, usuarioId: ctx.usuario.id, tipo: "EXPORTAR", status: "RODANDO" } });
    const { executarExportacao } = await import("@/lib/exportacao");
    void executarExportacao(t.id, ctx.conta.id);
    revalidatePath("/app", "layout");
    return { ok: "Exportação iniciada. Você pode continuar usando o sistema; avisamos no sino quando terminar." };
  });
}

export async function salvarLogo(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    if (ctx.conta.tipo !== "ASSESSORIA") return { erro: "O logo nos PDFs é do plano para assessorias." };
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { campos: { arquivo: "Escolha o arquivo do logo (PNG ou JPG)." } };
    if (!["image/png", "image/jpeg"].includes(arquivo.type)) return { campos: { arquivo: "Envie o logo em PNG ou JPG." } };
    if (arquivo.size > 2 * 1024 * 1024) return { campos: { arquivo: "O logo precisa ter até 2 MB." } };
    const { salvarArquivo, apagarArquivo } = await import("@/lib/storage");
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    if (ctx.conta.marcaLogo) await apagarArquivo(ctx.conta.marcaLogo).catch(() => {});
    await db.conta.update({ where: { id: ctx.conta.id }, data: { marcaLogo: s.caminho } });
    await registrarHistorico(ctx, "Trocou o logo dos PDFs");
    revalidatePath("/app/configuracoes");
    return { ok: "Logo salvo. Ele aparece nos próximos PDFs gerados." };
  });
}

export async function removerLogo(): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("gerenciar_conta");
    if (ctx.conta.marcaLogo) {
      const { apagarArquivo } = await import("@/lib/storage");
      await apagarArquivo(ctx.conta.marcaLogo).catch(() => {});
    }
    await db.conta.update({ where: { id: ctx.conta.id }, data: { marcaLogo: null } });
    revalidatePath("/app/configuracoes");
    return { ok: "Logo removido." };
  });
}
