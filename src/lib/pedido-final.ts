import "server-only";
import type { Pedido } from "@prisma/client";
import { ErroUsuario } from "./acao";
import { lerArquivo } from "./storage";
import { aprovacaoValida, hashCalculo } from "./pedido-regras";
import { situacaoChecklist } from "./pedido";
import { db } from "./db";

type PedidoFinal = Pedido & { documentos: { tipo: string; nome: string; caminho: string }[] };

export async function validarDocumentoFinal(p: PedidoFinal) {
  if (!aprovacaoValida(p) || !p.memoriaVersaoAprovadaId)
    throw new ErroUsuario("A versão atual da memória ainda não foi aprovada. Baixe a prévia RASCUNHO ou aprove a versão correta.");
  if (p.hashCalculo !== hashCalculo(p)) throw new ErroUsuario("A memória mudou depois da aprovação. Aprove a nova versão.");
  const versao = await db.memoriaVersao.findFirst({ where: { id: p.memoriaVersaoAprovadaId, pedidoId: p.id, hash: p.hashCalculo ?? undefined, aprovadoEm: { not: null } } });
  if (!versao || versao.numero !== p.memoriaVersaoAtual) throw new ErroUsuario("O arquivo final não corresponde à versão aprovada da memória. Aprove novamente a versão atual.");
  const faltas = situacaoChecklist(p, p.documentos).filter((x) => x.situacao === "FALTA");
  if (faltas.length) throw new ErroUsuario(`Arquivos obrigatórios ausentes: ${faltas.map((x) => x.nome).join("; ")}.`);
  const ausentes: string[] = [];
  for (const d of p.documentos) {
    try {
      await lerArquivo(d.caminho);
    } catch {
      ausentes.push(d.nome);
    }
  }
  if (ausentes.length) throw new ErroUsuario(`Arquivos não encontrados no armazenamento: ${ausentes.join("; ")}.`);
}
