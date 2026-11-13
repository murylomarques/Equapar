import "server-only";
/** E2: texto de um PDF (para procurar CPF antes de enviar à IA). Biblioteca só de leitura, sem binário nativo. */
import { extractText, getDocumentProxy } from "unpdf";

export async function textoDoPdf(pdf: Buffer): Promise<string> {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
