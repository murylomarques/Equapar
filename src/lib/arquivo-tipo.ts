/**
 * S4. Confere o conteúdo real do arquivo (assinatura) contra a extensão e devolve o tipo detectado.
 * PDF: "%PDF-". XLSX/DOCX: ZIP com [Content_Types].xml e a pasta xl/ ou word/ (os nomes ficam
 * sem compressão no diretório do ZIP). PNG e JPEG: assinatura. CSV: texto (sem bytes nulos, UTF-8 válido).
 */

const TIPOS = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".csv": "text/csv",
} as const;
type Ext = keyof typeof TIPOS;

function comeca(buf: Buffer, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

function detectar(buf: Buffer): Ext | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return ".pdf";
  if (comeca(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ".png";
  if (comeca(buf, [0xff, 0xd8, 0xff])) return ".jpg";
  if (comeca(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const s = buf.toString("latin1");
    if (!s.includes("[Content_Types].xml")) return null;
    if (s.includes("xl/workbook") || s.includes("xl/")) return s.includes("word/") ? null : ".xlsx";
    if (s.includes("word/")) return ".docx";
    return null;
  }
  // Texto: sem byte nulo e decodifica como UTF-8 sem caractere de substituição
  if (buf.length && !buf.includes(0) && !new TextDecoder("utf-8").decode(buf).includes("\uFFFD")) return ".csv";
  return null;
}

/** Tipo detectado se bate com a extensão do nome; senão null (recusar). */
export function conferirTipo(nome: string, buf: Buffer): { ext: Ext; mime: string } | null {
  const m = nome.toLowerCase().match(/\.[a-z0-9]+$/);
  const extNome = m?.[0] === ".jpeg" ? ".jpg" : m?.[0];
  if (!extNome || !(extNome in TIPOS)) return null;
  const det = detectar(buf);
  if (det !== extNome) return null;
  return { ext: det, mime: TIPOS[det] };
}

/** Content-Disposition de anexo com nome ASCII de reserva e o nome real em UTF-8 (RFC 6266/5987). */
export function cabecalhoAnexo(nome: string): string {
  const ascii = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
