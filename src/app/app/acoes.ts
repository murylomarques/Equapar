"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto, contratoDaConta, exigir, registrarHistorico } from "@/lib/auth";
import { db } from "@/lib/db";
import { ErroCampos, tentar, texto, type Resultado } from "@/lib/acao";
import { cnpjValido, soDigitos } from "@/lib/cnpj";
import { registrarEvento } from "@/lib/eventos";
import { lerData, lerDinheiro } from "@/lib/format";
import { consultarPncp, PncpIndisponivel } from "@/lib/pncp";
import { salvarArquivo } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export async function selecionarEmpresa(empresaId: string | null) {
  const ctx = await contexto();
  if (empresaId && !ctx.empresas.some((e) => e.id === empresaId)) throw new Error("Cliente não encontrado.");
  await db.sessao.update({ where: { id: ctx.sessaoId }, data: { empresaId } });
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------------------
// Importação do PNCP
// ---------------------------------------------------------------------------

async function importar(empresaId: string, contaId: string) {
  const empresa = await db.empresa.findFirst({ where: { id: empresaId, contaId } });
  if (!empresa) throw new Error("Empresa não encontrada.");
  let r;
  try {
    r = await consultarPncp(empresa.cnpj, { semCache: true, timeoutMs: 20_000 });
  } catch (e) {
    if (e instanceof PncpIndisponivel) throw new Error("O PNCP não respondeu agora. Tente de novo em alguns minutos ou cadastre o contrato à mão.");
    throw e;
  }
  if (r.razaoSocial && empresa.razaoSocial.startsWith("CNPJ ")) await db.empresa.update({ where: { id: empresa.id }, data: { razaoSocial: r.razaoSocial } });
  let novos = 0;
  for (const c of r.contratos) {
    const existe = await db.contrato.findUnique({ where: { empresaId_pncpControle: { empresaId: empresa.id, pncpControle: c.controle } } });
    if (existe) {
      await db.contrato.update({ where: { id: existe.id }, data: { vigenciaFim: new Date(`${c.fim}T00:00:00Z`) } });
      continue;
    }
    await db.contrato.create({
      data: {
        empresaId: empresa.id,
        numero: c.numero,
        orgao: c.orgao,
        orgaoCnpj: c.orgaoCnpj,
        uf: c.uf,
        municipio: c.municipio,
        esfera: c.esfera,
        objeto: c.objeto,
        vigenciaInicio: new Date(`${c.inicio}T00:00:00Z`),
        vigenciaFim: new Date(`${c.fim}T00:00:00Z`),
        valorGlobal: c.valorGlobal ?? undefined,
        maoDeObraDedicada: c.sugereMaoDeObra,
        pncpControle: c.controle,
        linkPncp: c.link,
      },
    });
    novos++;
  }
  await registrarEvento("contratos_importados", { encontrados: r.contratos.length, novos });
  return { encontrados: r.contratos.length, novos };
}

export async function importarPncp(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const empresaId = texto(fd, "empresaId") || ctx.empresaId;
    if (!empresaId) return { erro: "Escolha um cliente no topo antes de importar." };
    const { encontrados, novos } = await importar(empresaId, ctx.conta.id);
    await registrarHistorico(ctx, "Importou contratos do PNCP", { detalhe: `${novos} novos de ${encontrados}` });
    revalidatePath("/app", "layout");
    return { ok: novos ? `${novos} contratos novos importados do PNCP.` : `Nenhum contrato novo. ${encontrados} já estavam na carteira.` };
  });
}

// ---------------------------------------------------------------------------
// Primeiros 10 minutos
// ---------------------------------------------------------------------------

export async function onboardingImportar(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await importarPncp(_, fd);
  if (r.erro) return r;
  redirect("/app/boas-vindas?passo=contratos");
}

export async function onboardingMarcar(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const marcados = new Set(fd.getAll("maoDeObra").map(String));
    const contratos = await db.contrato.findMany({ where: { empresa: { contaId: ctx.conta.id } }, select: { id: true } });
    for (const c of contratos) await db.contrato.update({ where: { id: c.id }, data: { maoDeObraDedicada: marcados.has(c.id) } });
    redirect("/app/boas-vindas?passo=convencoes");
  });
}

/** Passo 3: uma convenção por grupo de cidade. Campos: grupo[]=chave; conv_<chave>=id|nova|naosei; e campos da nova. */
export async function onboardingConvencoes(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const grupos = fd.getAll("grupo").map(String);
    for (const g of grupos) {
      const ids = String(fd.get(`ids_${g}`) ?? "").split(",").filter(Boolean);
      const escolha = String(fd.get(`conv_${g}`) ?? "naosei");
      if (escolha === "naosei") {
        for (const id of ids) {
          const c = await contratoDaConta(ctx, id);
          const ja = await db.tarefa.findFirst({ where: { contratoId: id, titulo: "Descobrir a convenção", feitaEm: null } });
          if (!ja) await db.tarefa.create({ data: { contaId: ctx.conta.id, contratoId: c.id, titulo: "Descobrir a convenção" } });
        }
        continue;
      }
      let convId = escolha;
      if (escolha === "nova") {
        const nome = String(fd.get(`nome_${g}`) ?? "").trim();
        const uf = String(fd.get(`uf_${g}`) ?? "").trim().toUpperCase();
        const mes = Number(fd.get(`mes_${g}`));
        const ano = Number(fd.get(`ano_${g}`));
        if (!nome || uf.length !== 2 || !(mes >= 1 && mes <= 12) || !(ano > 2000)) return { erro: `Complete a convenção de ${g}: nome, UF, mês da data-base e ano.` };
        const conv = await db.convencao.create({
          data: { contaId: ctx.conta.id, nome, uf, cidade: String(fd.get(`cidade_${g}`) ?? "") || null, mesDataBase: mes, ano },
        });
        convId = conv.id;
      } else {
        const conv = await db.convencao.findFirst({ where: { id: escolha, contaId: ctx.conta.id } });
        if (!conv) return { erro: "Convenção não encontrada." };
      }
      for (const id of ids) {
        await contratoDaConta(ctx, id);
        await db.contrato.update({ where: { id }, data: { convencaoId: convId } });
      }
      await registrarEvento("convencao_confirmada", { contratos: ids.length });
    }
    redirect("/app/boas-vindas?passo=pronto");
  });
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

function dadosContrato(fd: FormData) {
  const campos: Record<string, string> = {};
  const numero = texto(fd, "numero");
  const orgao = texto(fd, "orgao");
  const objeto = texto(fd, "objeto");
  if (!numero) campos.numero = "Digite o número do contrato, como 45/2025.";
  if (!orgao) campos.orgao = "Digite o nome do órgão contratante.";
  if (!objeto) campos.objeto = "Descreva o objeto do contrato.";
  const inicio = lerData(fd.get("vigenciaInicio"));
  const fim = lerData(fd.get("vigenciaFim"));
  if (!inicio) campos.vigenciaInicio = "Digite a data de início da vigência (dd/mm/aaaa).";
  if (!fim) campos.vigenciaFim = "Digite a data de fim da vigência (dd/mm/aaaa).";
  if (inicio && fim && fim <= inicio) campos.vigenciaFim = "O fim da vigência precisa ser depois do início.";
  const valorTxt = texto(fd, "valorMensal");
  const valorMensal = lerDinheiro(fd.get("valorMensal"));
  if (valorTxt && valorMensal === null) campos.valorMensal = "Digite o valor mensal em reais, como 48.300,00.";
  const postosTxt = texto(fd, "postos");
  const postos = postosTxt ? Number(postosTxt) : null;
  if (postos !== null && (!Number.isInteger(postos) || postos < 0)) campos.postos = "Digite a quantidade de postos em número inteiro.";
  const dataPropostaTxt = texto(fd, "dataProposta");
  const dataProposta = lerData(fd.get("dataProposta"));
  if (dataPropostaTxt && !dataProposta) campos.dataProposta = "Data da proposta inválida. Use dd/mm/aaaa.";
  const apostTxt = texto(fd, "ultimoApostilamento");
  const ultimoApostilamento = lerData(fd.get("ultimoApostilamento"));
  if (apostTxt && !ultimoApostilamento) campos.ultimoApostilamento = "Data do apostilamento inválida. Use dd/mm/aaaa.";
  if (Object.keys(campos).length) throw new ErroCampos(campos);
  return {
    numero,
    orgao,
    objeto,
    uf: texto(fd, "uf").toUpperCase().slice(0, 2) || null,
    municipio: texto(fd, "municipio") || null,
    esfera: texto(fd, "esfera") || null,
    vigenciaInicio: inicio!,
    vigenciaFim: fim!,
    valorMensal,
    postos,
    maoDeObraDedicada: fd.get("maoDeObraDedicada") === "on",
    tipoReajuste: fd.get("tipoReajuste") === "INDICE" ? ("INDICE" as const) : ("REPACTUACAO" as const),
    clausulaReajuste: texto(fd, "clausulaReajuste") || null,
    convencaoId: texto(fd, "convencaoId") || null,
    dataProposta,
    ultimoApostilamento,
  };
}

export async function criarContrato(_: Resultado, fd: FormData): Promise<Resultado> {
  let id = "";
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const empresaId = texto(fd, "empresaId") || ctx.empresaId;
    if (!empresaId || !ctx.empresas.some((e) => e.id === empresaId)) return { campos: { empresaId: "Escolha a empresa do contrato." } };
    const d = dadosContrato(fd);
    if (d.convencaoId && !(await db.convencao.findFirst({ where: { id: d.convencaoId, contaId: ctx.conta.id } }))) return { erro: "Convenção inválida." };
    const c = await db.contrato.create({ data: { ...d, empresaId } });
    await registrarHistorico(ctx, "Cadastrou o contrato à mão", { contratoId: c.id });
    id = c.id;
  });
  if (r.erro) return r;
  redirect(`/app/contratos/${id}`);
}

export async function editarContrato(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const c = await contratoDaConta(ctx, texto(fd, "id"));
    const d = dadosContrato(fd);
    if (d.convencaoId && !(await db.convencao.findFirst({ where: { id: d.convencaoId, contaId: ctx.conta.id } }))) return { erro: "Convenção inválida." };
    await db.contrato.update({ where: { id: c.id }, data: d });
    if (d.convencaoId) await db.tarefa.updateMany({ where: { contratoId: c.id, titulo: "Descobrir a convenção", feitaEm: null }, data: { feitaEm: new Date() } });
    await registrarHistorico(ctx, "Editou os dados do contrato", { contratoId: c.id });
    revalidatePath(`/app/contratos/${c.id}`);
    return { ok: "Contrato salvo." };
  });
}

export async function arquivarContrato(_: Resultado, fd: FormData): Promise<Resultado> {
  const r = await tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    const c = await contratoDaConta(ctx, texto(fd, "id"));
    await db.contrato.update({ where: { id: c.id }, data: { arquivado: true } });
    await registrarHistorico(ctx, "Arquivou o contrato", { contratoId: c.id });
  });
  if (r.erro) return r;
  redirect("/app/carteira");
}

export async function enviarDocumentoContrato(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const c = await contratoDaConta(ctx, texto(fd, "contratoId"));
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo." };
    const tipo = texto(fd, "tipo") || "OUTRO";
    const s = await salvarArquivo(ctx.conta.id, arquivo);
    const versao = (await db.documento.count({ where: { contratoId: c.id, tipo, nome: s.nome } })) + 1;
    await db.documento.create({ data: { contratoId: c.id, tipo, nome: s.nome, versao, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
    await registrarHistorico(ctx, `Anexou o documento ${s.nome}`, { contratoId: c.id });
    revalidatePath(`/app/contratos/${c.id}`);
    return { ok: "Documento anexado." };
  });
}

// ---------------------------------------------------------------------------
// Convenções
// ---------------------------------------------------------------------------

function dadosConvencao(fd: FormData) {
  const campos: Record<string, string> = {};
  const nome = texto(fd, "nome");
  const uf = texto(fd, "uf").toUpperCase();
  const ano = Number(texto(fd, "ano"));
  const mes = Number(texto(fd, "mesDataBase"));
  if (!nome) campos.nome = "Dê um nome à convenção, como “CCT Asseio e Conservação ES 2026”.";
  if (uf.length !== 2) campos.uf = "Escolha a UF da base territorial.";
  if (!(mes >= 1 && mes <= 12)) campos.mesDataBase = "Escolha o mês da data-base.";
  if (!(ano > 2000 && ano < 2100)) campos.ano = "Digite o ano da convenção, como 2026.";
  const depTxt = texto(fd, "dataDeposito");
  const dataDeposito = lerData(fd.get("dataDeposito"));
  if (depTxt && !dataDeposito) campos.dataDeposito = "Data do depósito inválida. Use dd/mm/aaaa.";
  if (Object.keys(campos).length) throw new ErroCampos(campos);
  const registroMte = texto(fd, "registroMte") || null;
  return {
    nome,
    uf,
    ano,
    mesDataBase: mes,
    cidade: texto(fd, "cidade") || null,
    sindicatos: texto(fd, "sindicatos") || null,
    categoria: texto(fd, "categoria") || "Asseio e conservação",
    dataDeposito,
    registroMte,
    situacao: dataDeposito ? ("REGISTRADA" as const) : ("PENDENTE" as const),
    observacoes: texto(fd, "observacoes") || null,
  };
}

export async function salvarConvencao(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_pedidos");
    const d = dadosConvencao(fd);
    const id = texto(fd, "id");
    let convId = id;
    if (id) {
      const c = await db.convencao.findFirst({ where: { id, contaId: ctx.conta.id } });
      if (!c) return { erro: "Convenção não encontrada." };
      await db.convencao.update({ where: { id }, data: d });
    } else {
      convId = (await db.convencao.create({ data: { ...d, contaId: ctx.conta.id } })).id;
    }
    const arquivo = fd.get("arquivo");
    if (arquivo instanceof File && arquivo.size > 0) {
      const s = await salvarArquivo(ctx.conta.id, arquivo);
      await db.documento.create({ data: { convencaoId: convId, tipo: "CONVENCAO", nome: s.nome, mime: s.mime, tamanho: s.tamanho, caminho: s.caminho, enviadoPor: ctx.usuario.nome } });
    }
    await registrarHistorico(ctx, id ? `Editou a convenção ${d.nome}` : `Cadastrou a convenção ${d.nome}`);
    revalidatePath("/app/convencoes");
    return { ok: id ? "Convenção salva." : "Convenção cadastrada." };
  });
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export async function concluirTarefa(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    await db.tarefa.updateMany({ where: { id: texto(fd, "id"), contaId: ctx.conta.id }, data: { feitaEm: new Date() } });
    revalidatePath("/app/hoje");
  });
}

// ---------------------------------------------------------------------------
// Clientes (assessoria)
// ---------------------------------------------------------------------------

export async function adicionarCliente(_: Resultado, fd: FormData): Promise<Resultado> {
  return tentar(async (): Promise<Resultado | void> => {
    const ctx = await exigir("editar_contratos");
    if (ctx.conta.tipo !== "ASSESSORIA") return { erro: "Só contas de assessoria têm vários clientes." };
    const cnpj = soDigitos(texto(fd, "cnpj"));
    if (!cnpjValido(cnpj)) return { campos: { cnpj: "Esse CNPJ não existe. Confira os 14 números." } };
    if (ctx.empresas.some((e) => e.cnpj === cnpj)) return { campos: { cnpj: "Este cliente já está na conta." } };
    let razao = texto(fd, "razaoSocial");
    if (!razao) {
      try {
        razao = (await consultarPncp(cnpj, { timeoutMs: 8000 })).razaoSocial ?? "";
      } catch {
        /* sem razão social do PNCP */
      }
    }
    const e = await db.empresa.create({ data: { contaId: ctx.conta.id, cnpj, razaoSocial: razao || `CNPJ ${cnpj}` } });
    await registrarHistorico(ctx, `Adicionou o cliente ${e.razaoSocial}`);
    if (fd.get("importar") === "on") {
      try {
        await importar(e.id, ctx.conta.id);
      } catch (err) {
        revalidatePath("/app", "layout");
        return { ok: `Cliente adicionado. ${(err as Error).message}` };
      }
    }
    revalidatePath("/app", "layout");
    return { ok: "Cliente adicionado." };
  });
}
