import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { cabecalhoAnexo, conferirTipo } from "./arquivo-tipo";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
async function xlsx() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("A").addRow(["x", 1]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function docx() {
  const z = new JSZip();
  z.file("[Content_Types].xml", "<Types/>");
  z.file("word/document.xml", "<w:document/>");
  return z.generateAsync({ type: "nodebuffer" });
}

describe("S4: conteúdo real do arquivo", () => {
  it("aceita cada tipo pela assinatura e devolve o tipo detectado", async () => {
    expect(conferirTipo("a.pdf", pdf)).toEqual({ ext: ".pdf", mime: "application/pdf" });
    expect(conferirTipo("a.png", png)?.mime).toBe("image/png");
    expect(conferirTipo("a.jpeg", jpg)?.ext).toBe(".jpg");
    expect(conferirTipo("planilha.xlsx", await xlsx())?.ext).toBe(".xlsx");
    expect(conferirTipo("oficio.docx", await docx())?.ext).toBe(".docx");
    expect(conferirTipo("dados.csv", Buffer.from("a;b\n1;2\n"))?.mime).toBe("text/csv");
  });
  it("recusa conteúdo que não bate com a extensão", async () => {
    expect(conferirTipo("convencao.pdf", Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(conferirTipo("planilha.xlsx", pdf)).toBeNull();
    expect(conferirTipo("planilha.xlsx", await docx())).toBeNull(); // Word com extensão de Excel
    expect(conferirTipo("foto.png", jpg)).toBeNull();
    expect(conferirTipo("dados.csv", Buffer.from([0x50, 0x4b, 3, 4, 0, 0]))).toBeNull(); // binário como CSV
    expect(conferirTipo("script.exe", pdf)).toBeNull();
  });
});

describe("S4: nome do arquivo no download", () => {
  it("antes: encodeURIComponent no filename chegava como Conven%C3%A7%C3%A3o.pdf", () => {
    expect(`attachment; filename="${encodeURIComponent("Convenção.pdf")}"`).toContain("Conven%C3%A7%C3%A3o.pdf");
  });
  it("agora: anexo com nome ASCII de reserva e filename* em UTF-8", () => {
    const h = cabecalhoAnexo("Convenção coletiva 2026.pdf");
    expect(h).toBe(`attachment; filename="Convencao coletiva 2026.pdf"; filename*=UTF-8''Conven%C3%A7%C3%A3o%20coletiva%202026.pdf`);
    expect(cabecalhoAnexo('a"b\\c.pdf')).toContain('filename="a_b_c.pdf"');
  });
});
