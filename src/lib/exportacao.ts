import "server-only";
import JSZip from "jszip";
import { db } from "./db";
import { gravarArquivo, lerArquivo } from "./storage";

/** Monta o ZIP "Exportar tudo" (LGPD): dados da conta em JSON + arquivos enviados. */
export async function montarExportacao(contaId: string) {
  const conta = await db.conta.findUnique({
    where: { id: contaId },
    include: {
      membros: { include: { usuario: { select: { nome: true, email: true, whatsapp: true, criadoEm: true } } } },
      empresas: { include: { contratos: { include: { pedidos: { include: { comentarios: true, memorias: true, notasFiscais: true, baixas: true } }, documentos: true, historicoValores: true } } } },
      convencoes: { include: { documentos: true } },
      historicos: true,
      avisos: true,
      tarefas: true,
      faturas: true,
    },
  });
  const zip = new JSZip();
  zip.file("dados.json", JSON.stringify(conta, null, 2));
  const docs = await db.documento.findMany({
    where: { OR: [{ contrato: { empresa: { contaId } } }, { pedido: { contrato: { empresa: { contaId } } } }, { convencao: { contaId } }] },
  });
  const ausentes: { id: string; nome: string; caminho: string }[] = [];
  for (const d of docs) {
    try {
      zip.file(`arquivos/${d.id}-${d.nome}`, await lerArquivo(d.caminho));
    } catch {
      ausentes.push({ id: d.id, nome: d.nome, caminho: d.caminho });
    }
  }
  zip.file("arquivos-ausentes.json", JSON.stringify({ total: ausentes.length, arquivos: ausentes }, null, 2));
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Roda a exportação em segundo plano e registra o resultado no TrabalhoFundo. */
export async function executarExportacao(trabalhoId: string, contaId: string) {
  try {
    const buf = await montarExportacao(contaId);
    const rel = `${contaId}/exportacoes/${trabalhoId}.zip`;
    await gravarArquivo(rel, buf, "application/zip");
    await db.trabalhoFundo.update({ where: { id: trabalhoId }, data: { status: "PRONTO", caminho: rel, concluidoEm: new Date() } });
  } catch (e) {
    console.error("[exportação]", e);
    await db.trabalhoFundo.update({
      where: { id: trabalhoId },
      data: { status: "ERRO", erro: "Não foi possível montar o arquivo. Tente de novo em instantes.", concluidoEm: new Date() },
    });
  }
}
