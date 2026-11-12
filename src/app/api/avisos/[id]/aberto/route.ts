import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aviso = await db.aviso.findUnique({ where: { id }, select: { tipo: true, canal: true } });
  if (aviso) await db.evento.create({ data: { nome: "aviso_aberto", props: { tipo: aviso.tipo, canal: aviso.canal } } });
  return new NextResponse(new Uint8Array(GIF), { headers: { "content-type": "image/gif", "cache-control": "no-store" } });
}
