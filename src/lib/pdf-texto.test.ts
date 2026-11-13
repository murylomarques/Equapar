import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { textoDoPdf } from "./pdf-texto";
import { contarCpfs } from "./cpf";

// E2: extrai o texto de um PDF de verdade (gerado aqui, com CPF FICTÍCIO gerado pelo algoritmo) antes da IA.
function gerarCpf(base: string) {
  const d = base.split("").map(Number);
  for (const n of [9, 10]) {
    const r = (d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0) * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  const c = d.join("");
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

async function pdfCom(linhas: string[]) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pag = doc.addPage();
  linhas.forEach((l, i) => pag.drawText(l, { x: 40, y: 760 - i * 20, size: 11, font: fonte }));
  return Buffer.from(await doc.save());
}

describe("E2: texto do PDF antes da IA", () => {
  it("acha o CPF numa folha com nomes", async () => {
    const t = await textoDoPdf(await pdfCom(["Folha de pagamento (exemplo)", `Pessoa Exemplo - CPF ${gerarCpf("987654321")} - R$ 1.820,00`]));
    expect(contarCpfs(t)).toBe(1);
  });
  it("planilha de custos sem CPF passa", async () => {
    const t = await textoDoPdf(await pdfCom(["Planilha de custos (exemplo)", "Salario base 1.820,00", "CNPJ 11.222.333/0001-81"]));
    expect(contarCpfs(t)).toBe(0);
  });
});
