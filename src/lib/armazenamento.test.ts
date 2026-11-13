import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as sdk from "@aws-sdk/client-s3";
import { ArmazenamentoDisco, ArmazenamentoS3, normalizarChave } from "./armazenamento";

describe("4.1.2: armazenamento", () => {
  it("chave relativa, sem subir de pasta", () => {
    expect(normalizarChave("conta1\\docs\\a.pdf")).toBe("conta1/docs/a.pdf");
    expect(() => normalizarChave("../outra/a.pdf")).toThrow();
    expect(() => normalizarChave("conta1//a.pdf")).toThrow();
  });

  it("disco: grava, lê, apaga e apaga a pasta da conta", async () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "arm-"));
    const a: import("./armazenamento").Armazenamento = new ArmazenamentoDisco(raiz);
    await a.gravar("c1/x/a.txt", Buffer.from("oi"), "text/plain");
    expect((await a.ler("c1/x/a.txt")).toString()).toBe("oi");
    await a.gravar("c1/b.txt", Buffer.from("b"), "text/plain");
    await a.apagar("c1/b.txt");
    await expect(a.ler("c1/b.txt")).rejects.toThrow();
    await a.apagarPrefixo("c1");
    expect(fs.existsSync(path.join(raiz, "c1"))).toBe(false);
  });

  it("S3: comandos certos no bucket privado (cifrado), apaga prefixo em páginas e assina link curto", async () => {
    const enviados: { nome: string; input: Record<string, unknown> }[] = [];
    const objetos = new Map<string, Buffer>([
      ["c1/a.pdf", Buffer.from("%PDF")],
      ["c1/b.pdf", Buffer.from("%PDF")],
      ["c2/z.pdf", Buffer.from("%PDF")],
    ]);
    const cliente = {
      async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }) {
        enviados.push({ nome: cmd.constructor.name, input: cmd.input });
        const i = cmd.input as { Key?: string; Prefix?: string; Body?: Buffer; Delete?: { Objects: { Key: string }[] } };
        if (cmd instanceof sdk.PutObjectCommand) objetos.set(i.Key!, i.Body!);
        if (cmd instanceof sdk.GetObjectCommand) return { Body: { transformToByteArray: async () => new Uint8Array(objetos.get(i.Key!)!) } };
        if (cmd instanceof sdk.ListObjectsV2Command) return { Contents: [...objetos.keys()].filter((k) => k.startsWith(i.Prefix!)).map((Key) => ({ Key })) };
        if (cmd instanceof sdk.DeleteObjectsCommand) for (const o of i.Delete!.Objects) objetos.delete(o.Key);
        return {};
      },
    };
    let assinado: { expiresIn: number } | null = null;
    const s3 = new ArmazenamentoS3(cliente, "equapar-privado", sdk, async (_c, _cmd, o) => ((assinado = o), "https://exemplo/assinado"));
    await s3.gravar("c1/n.xlsx", Buffer.from("PK"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(enviados[0]).toMatchObject({ nome: "PutObjectCommand", input: { Bucket: "equapar-privado", Key: "c1/n.xlsx", ServerSideEncryption: "AES256" } });
    expect((await s3.ler("c1/n.xlsx")).toString()).toBe("PK");
    await s3.apagarPrefixo("c1");
    expect([...objetos.keys()]).toEqual(["c2/z.pdf"]);
    expect(await s3.linkTemporario("c2/z.pdf", "Convenção.pdf")).toBe("https://exemplo/assinado");
    expect(assinado).toEqual({ expiresIn: 300 });
  });
});
