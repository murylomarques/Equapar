import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

/** Pequeno motor de layout para PDFs A4 com quebra de linha, tabelas e paginação. */

export const COR = {
  tinta: rgb(0x16 / 255, 0x18 / 255, 0x1d / 255),
  grafite: rgb(0x5b / 255, 0x5f / 255, 0x66 / 255),
  linha: rgb(0xe3 / 255, 0xde / 255, 0xd3 / 255),
  verde: rgb(0x1e / 255, 0x7a / 255, 0x55 / 255),
  carimbo: rgb(0xb2 / 255, 0x3a / 255, 0x1c / 255),
  papel: rgb(0xf4 / 255, 0xf1 / 255, 0xea / 255),
};

export function hexParaRgb(hex?: string | null): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica padrão usa WinAnsi: troca caracteres fora dele. */
export function limpar(s: string) {
  return (s ?? "")
    .replace(/−/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[≈]/g, "~")
    .replace(/[→]/g, "->")
    .replace(/[×]/g, "x")
    .replace(/[÷]/g, "/")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF•–—…ºª·]/g, "");
}

export class Pdf {
  doc!: PDFDocument;
  page!: PDFPage;
  regular!: PDFFont;
  negrito!: PDFFont;
  y = 0;
  readonly margem = 50;
  readonly largura = 595.28;
  readonly altura = 841.89;
  rodape = "";
  acento: RGB = COR.verde;

  static async criar(rodape: string, acento?: RGB | null) {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    p.regular = await p.doc.embedFont(StandardFonts.Helvetica);
    p.negrito = await p.doc.embedFont(StandardFonts.HelveticaBold);
    p.rodape = limpar(rodape);
    if (acento) p.acento = acento;
    p.novaPagina();
    return p;
  }

  get util() {
    return this.largura - this.margem * 2;
  }

  novaPagina() {
    this.page = this.doc.addPage([this.largura, this.altura]);
    this.y = this.altura - this.margem;
    const n = this.doc.getPageCount();
    this.page.drawText(`${this.rodape} · página ${n}`, { x: this.margem, y: 28, size: 8, font: this.regular, color: COR.grafite });
  }

  garantir(h: number) {
    if (this.y - h < this.margem + 10) this.novaPagina();
  }

  quebrar(texto: string, fonte: PDFFont, tam: number, largura: number) {
    const linhas: string[] = [];
    for (const par of limpar(texto).split("\n")) {
      let atual = "";
      for (const palavra of par.split(/\s+/)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(teste, tam) <= largura) atual = teste;
        else {
          if (atual) linhas.push(atual);
          // palavra maior que a linha: corta
          let p = palavra;
          while (fonte.widthOfTextAtSize(p, tam) > largura && p.length > 1) {
            let i = p.length;
            while (i > 1 && fonte.widthOfTextAtSize(p.slice(0, i), tam) > largura) i--;
            linhas.push(p.slice(0, i));
            p = p.slice(i);
          }
          atual = p;
        }
      }
      linhas.push(atual);
    }
    return linhas;
  }

  texto(t: string, o: { tam?: number; negrito?: boolean; cor?: RGB; espaco?: number; x?: number; largura?: number } = {}) {
    const tam = o.tam ?? 10;
    const fonte = o.negrito ? this.negrito : this.regular;
    const linhas = this.quebrar(t, fonte, tam, o.largura ?? this.util - ((o.x ?? this.margem) - this.margem));
    for (const l of linhas) {
      this.garantir(tam * 1.45);
      this.page.drawText(l, { x: o.x ?? this.margem, y: this.y - tam, size: tam, font: fonte, color: o.cor ?? COR.tinta });
      this.y -= tam * 1.45;
    }
    this.y -= o.espaco ?? 4;
  }

  titulo(t: string, tam = 16) {
    this.garantir(tam * 2.4);
    this.y -= 4;
    this.texto(t, { tam, negrito: true, espaco: 6 });
  }

  regua(cor: RGB = COR.linha) {
    this.garantir(10);
    this.page.drawLine({ start: { x: this.margem, y: this.y }, end: { x: this.largura - this.margem, y: this.y }, thickness: 1, color: cor });
    this.y -= 10;
  }

  selo(t: string, cor: RGB) {
    const tam = 10;
    const w = this.negrito.widthOfTextAtSize(limpar(t), tam) + 16;
    this.garantir(26);
    const x = this.largura - this.margem - w;
    const y = this.altura - this.margem - 22;
    this.page.drawRectangle({ x, y, width: w, height: 20, borderColor: cor, borderWidth: 1.5, rotate: degrees(-2) });
    this.page.drawText(limpar(t), { x: x + 8, y: y + 6, size: tam, font: this.negrito, color: cor, rotate: degrees(-2) });
  }

  /** Tabela simples. larguras em fração da largura útil; alinhar "d" = direita. */
  tabela(cab: string[], linhas: string[][], larguras: number[], alinhar: ("e" | "d")[] = [], tam = 8.5) {
    const ws = larguras.map((f) => f * this.util);
    const desenharLinha = (cel: string[], negrito: boolean, fundo?: RGB) => {
      const fonte = negrito ? this.negrito : this.regular;
      const quebradas = cel.map((c, i) => this.quebrar(c ?? "", fonte, tam, ws[i] - 6));
      const h = Math.max(...quebradas.map((q) => q.length)) * tam * 1.35 + 6;
      this.garantir(h);
      if (fundo) this.page.drawRectangle({ x: this.margem, y: this.y - h, width: this.util, height: h, color: fundo });
      let x = this.margem;
      quebradas.forEach((q, i) => {
        q.forEach((l, j) => {
          const w = fonte.widthOfTextAtSize(l, tam);
          const lx = alinhar[i] === "d" ? x + ws[i] - 3 - w : x + 3;
          this.page.drawText(l, { x: lx, y: this.y - 3 - tam - j * tam * 1.35, size: tam, font: fonte, color: COR.tinta });
        });
        x += ws[i];
      });
      this.y -= h;
      this.page.drawLine({ start: { x: this.margem, y: this.y }, end: { x: this.largura - this.margem, y: this.y }, thickness: 0.5, color: COR.linha });
    };
    desenharLinha(cab, true, COR.papel);
    for (const l of linhas) desenharLinha(l, l[0]?.startsWith("Total") || l[0]?.startsWith("TOTAL"), undefined);
    this.y -= 8;
  }

  async bytes() {
    return Buffer.from(await this.doc.save());
  }
}
