/**
 * Fase 1 (4.1.2). Armazenamento de arquivos atrás de uma interface, para o app não guardar estado no
 * servidor: em desenvolvimento, disco (STORAGE_DIR); em produção, um bucket privado compatível com S3
 * (AWS S3, Cloudflare R2, MinIO, Backblaze…), com chaves por conta ("<contaId>/...") e links assinados curtos.
 *
 * ARMAZENAMENTO=s3 liga o S3 (precisa de S3_BUCKET, S3_REGION e as credenciais; S3_ENDPOINT para os
 * compatíveis). Sem isso, disco.
 */
import fs from "node:fs/promises";
import path from "node:path";

export interface Armazenamento {
  readonly tipo: "disco" | "s3";
  gravar(chave: string, dados: Buffer, mime: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  apagar(chave: string): Promise<void>;
  /** Apaga tudo com o prefixo (ex.: a pasta de uma conta). */
  apagarPrefixo(prefixo: string): Promise<void>;
  /** Link de download de curta duração (só no S3; no disco, o download passa pelo app). */
  linkTemporario?(chave: string, nomeArquivo: string, segundos?: number): Promise<string>;
}

/** Chave sempre relativa, com "/" e sem subir de pasta. */
export function normalizarChave(chave: string): string {
  const c = chave.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!c || c.split("/").some((p) => p === ".." || p === "")) throw new Error("Chave de arquivo inválida.");
  return c;
}

export class ArmazenamentoDisco implements Armazenamento {
  readonly tipo = "disco" as const;
  constructor(private raiz: string) {}
  private abs(chave: string) {
    const a = path.resolve(/*turbopackIgnore: true*/ this.raiz, normalizarChave(chave));
    if (!a.startsWith(path.resolve(/*turbopackIgnore: true*/ this.raiz) + path.sep)) throw new Error("Caminho inválido.");
    return a;
  }
  async gravar(chave: string, dados: Buffer) {
    const a = this.abs(chave);
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(a), { recursive: true });
    await fs.writeFile(/*turbopackIgnore: true*/ a, dados);
  }
  async ler(chave: string) {
    return fs.readFile(/*turbopackIgnore: true*/ this.abs(chave));
  }
  async apagar(chave: string) {
    await fs.rm(/*turbopackIgnore: true*/ this.abs(chave), { force: true });
  }
  async apagarPrefixo(prefixo: string) {
    await fs.rm(/*turbopackIgnore: true*/ this.abs(prefixo), { recursive: true, force: true });
  }
}

/** Cliente mínimo usado (o S3Client da AWS cumpre; nos testes, um falso). */
export interface ClienteS3 {
  send(comando: unknown): Promise<unknown>;
}

export class ArmazenamentoS3 implements Armazenamento {
  readonly tipo = "s3" as const;
  constructor(
    private cliente: ClienteS3,
    private bucket: string,
    private sdk: typeof import("@aws-sdk/client-s3"),
    private assinar?: (cliente: ClienteS3, comando: unknown, opts: { expiresIn: number }) => Promise<string>,
  ) {}
  async gravar(chave: string, dados: Buffer, mime: string) {
    await this.cliente.send(new this.sdk.PutObjectCommand({ Bucket: this.bucket, Key: normalizarChave(chave), Body: dados, ContentType: mime, ServerSideEncryption: "AES256" }));
  }
  async ler(chave: string) {
    const r = (await this.cliente.send(new this.sdk.GetObjectCommand({ Bucket: this.bucket, Key: normalizarChave(chave) }))) as { Body?: { transformToByteArray(): Promise<Uint8Array> } };
    if (!r.Body) throw new Error("Arquivo não encontrado.");
    return Buffer.from(await r.Body.transformToByteArray());
  }
  async apagar(chave: string) {
    await this.cliente.send(new this.sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: normalizarChave(chave) }));
  }
  async apagarPrefixo(prefixo: string) {
    const p = `${normalizarChave(prefixo).replace(/\/$/, "")}/`;
    let token: string | undefined;
    do {
      const r = (await this.cliente.send(new this.sdk.ListObjectsV2Command({ Bucket: this.bucket, Prefix: p, ContinuationToken: token }))) as {
        Contents?: { Key?: string }[];
        NextContinuationToken?: string;
      };
      const chaves = (r.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
      if (chaves.length) await this.cliente.send(new this.sdk.DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: chaves.map((Key) => ({ Key })) } }));
      token = r.NextContinuationToken;
    } while (token);
  }
  async linkTemporario(chave: string, nomeArquivo: string, segundos = 300) {
    if (!this.assinar) throw new Error("Assinatura de link indisponível.");
    const nome = encodeURIComponent(nomeArquivo);
    const cmd = new this.sdk.GetObjectCommand({ Bucket: this.bucket, Key: normalizarChave(chave), ResponseContentDisposition: `attachment; filename*=UTF-8''${nome}` });
    return this.assinar(this.cliente, cmd, { expiresIn: segundos });
  }
}

let atual: Promise<Armazenamento> | null = null;

/** O armazenamento configurado (um por processo). */
export function armazenamento(): Promise<Armazenamento> {
  atual ??= (async () => {
    if (process.env.ARMAZENAMENTO !== "s3") return new ArmazenamentoDisco(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("ARMAZENAMENTO=s3 sem S3_BUCKET.");
    const sdk = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const cliente = new sdk.S3Client({
      region: process.env.S3_REGION ?? "auto",
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    });
    return new ArmazenamentoS3(cliente, bucket, sdk, (c, cmd, o) => getSignedUrl(c as never, cmd as never, o));
  })();
  return atual;
}
