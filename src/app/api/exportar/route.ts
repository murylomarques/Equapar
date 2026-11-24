import JSZip from "jszip";
import { NextResponse } from "next/server";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerArquivo } from "@/lib/storage";
import { cabecalhoAnexo } from "@/lib/arquivo-tipo";

/** "Exportar tudo" (LGPD): JSON com todos os dados da conta + arquivos enviados. */
export async function GET() {
  const ctx = await contexto();
  if (!pode(ctx.papel, "gerenciar_conta")) return new NextResponse("Só o Dono exporta os dados da conta.", { status: 403 });
  const conta = await db.conta.findUnique({
    where: { id: ctx.conta.id },
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
    where: { OR: [{ contrato: { empresa: { contaId: ctx.conta.id } } }, { pedido: { contrato: { empresa: { contaId: ctx.conta.id } } } }, { convencao: { contaId: ctx.conta.id } }] },
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
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": "application/zip", "content-disposition": cabecalhoAnexo(`equapar-exportacao-${new Date().toISOString().slice(0, 10)}.zip`) },
  });
}
