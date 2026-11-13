/**
 * E3. Gera o PDF da convenção FICTÍCIA usada para testar a avaliação (convencoes-ficticias/FIC000001-2026.pdf,
 * fora do git). Valores inventados, iguais a fixtures/convencao-ficticia/gabarito.json. Sem nomes de pessoas.
 *   npx tsx scripts/gerar-convencao-ficticia.ts
 */
import fs from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const paginas: string[][] = [
  ["CONVENCAO COLETIVA DE TRABALHO FICTICIA 2026 (EXEMPLO PARA TESTE)", "Registro ficticio FIC000001/2026", "", "CLAUSULA 3a - PISOS SALARIAIS", "Servente (44 h): R$ 1.850,00 por mes.", "Encarregado (44 h): R$ 2.450,00 por mes."],
  ["CLAUSULA 8a - INSALUBRIDADE", "Adicional de 20% do salario minimo no grau medio.", "", "CLAUSULA 10a - AUXILIO-ALIMENTACAO", "R$ 25,00 por dia trabalhado, com jornada acima de 6 horas.", "", "CLAUSULA 11a - VALE-TRANSPORTE", "Desconto de ate 6% do salario-base."],
  ["CLAUSULA 12a - CESTA BASICA", "R$ 180,00 por mes na jornada integral.", "", "CLAUSULA 13a - ASSISTENCIA A SAUDE", "Custeio de R$ 60,00 por empregado por mes.", "", "CLAUSULA 14a - SEGURO DE VIDA", "Facultativo.", "", "CLAUSULA 15a - BENEFICIO SOCIAL", "R$ 20,00 por empregado por mes."],
  ["CLAUSULA 20a - UNIFORMES", "Dois conjuntos por ano, fornecidos gratuitamente."],
];

async function main() {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const linhas of paginas) {
    const p = doc.addPage();
    linhas.forEach((l, i) => p.drawText(l, { x: 50, y: 780 - i * 22, size: 11, font: fonte }));
  }
  fs.mkdirSync("convencoes-ficticias", { recursive: true });
  fs.writeFileSync("convencoes-ficticias/FIC000001-2026.pdf", await doc.save());
  console.log("convencoes-ficticias/FIC000001-2026.pdf gerado (fictício).");
}
main();
