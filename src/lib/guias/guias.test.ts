import { describe, expect, it } from "vitest";
import { GUIAS, RASCUNHOS } from ".";

const TODOS = [...GUIAS, ...RASCUNHOS];
const SLUGS = new Set(GUIAS.map((g) => g.slug));

describe("guias: integridade do conteúdo", () => {
  it("slugs únicos e só com letras minúsculas, números e hífen", () => {
    expect(SLUGS.size).toBe(GUIAS.length);
    for (const g of TODOS) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("rascunho é sempre de um guia que existe (mesmo slug) e fica pendente", () => {
    for (const r of RASCUNHOS) {
      expect(SLUGS.has(r.slug)).toBe(true);
      expect(r.revisao).toBe("pendente");
    }
  });

  it("'Leia também' só aponta para guias que existem, nunca para o próprio", () => {
    for (const g of TODOS) for (const r of g.relacionados ?? []) {
      expect(SLUGS.has(r), `${g.slug} → ${r}`).toBe(true);
      expect(r).not.toBe(g.slug);
    }
  });

  it("título e descrição cabem no resultado do Google", () => {
    for (const g of TODOS) {
      expect(g.titulo.length, g.slug).toBeLessThanOrEqual(75);
      expect(g.descricao.length, g.slug).toBeLessThanOrEqual(170);
    }
  });

  it("tabelas: toda linha tem o mesmo número de colunas do cabeçalho", () => {
    for (const g of TODOS) for (const s of g.secoes) if (s.tabela) for (const l of s.tabela.linhas) expect(l.length, `${g.slug} / ${s.titulo}`).toBe(s.tabela.cabecalho.length);
  });

  it("sem textos repetidos onde viram chave na página (seções, parágrafos, itens, perguntas)", () => {
    const unicos = (xs: string[], onde: string) => expect(new Set(xs).size, onde).toBe(xs.length);
    for (const g of TODOS) {
      unicos(g.secoes.map((s) => s.titulo), `${g.slug}: seções`);
      for (const s of g.secoes) {
        unicos(s.paragrafos, `${g.slug} / ${s.titulo}: parágrafos`);
        unicos(s.lista ?? [], `${g.slug} / ${s.titulo}: lista`);
        unicos(s.tabela?.cabecalho ?? [], `${g.slug} / ${s.titulo}: cabeçalho`);
      }
      unicos((g.faq ?? []).map((f) => f.pergunta), `${g.slug}: FAQ`);
      unicos(g.resumo ?? [], `${g.slug}: resumo`);
      unicos(g.fontes.map((f) => f.url), `${g.slug}: fontes`);
    }
  });

  it("toda fonte é https, e todo guia novo (com data) passa pelo advogado antes de publicar", () => {
    for (const g of TODOS) {
      expect(g.fontes.length, g.slug).toBeGreaterThan(0);
      for (const f of g.fontes) expect(f.url, g.slug).toMatch(/^https:\/\//);
      if (g.atualizadoEm) expect(g.atualizadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
