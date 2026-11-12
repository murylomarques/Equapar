import { unstable_rethrow } from "next/navigation";

/** Resultado padrão das ações de servidor: o erro chega ao usuário em texto (também em produção). */
export interface Resultado {
  erro?: string;
  /** Erros por campo (chave = name do campo). Mostrados junto ao campo e no resumo de erros. */
  campos?: Record<string, string>;
  ok?: string;
  dados?: Record<string, unknown>;
}

export type Acao = (anterior: Resultado, fd: FormData) => Promise<Resultado>;

/** Erro de validação com campos, para lançar de dentro das ações. */
export class ErroCampos extends Error {
  constructor(
    public campos: Record<string, string>,
    mensagem = "Confira os campos destacados.",
  ) {
    super(mensagem);
  }
}

export async function tentar(fn: () => Promise<Resultado | void>): Promise<Resultado> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ErroCampos) return { erro: e.message, campos: e.campos };
    console.error(e);
    const msg = (e as Error)?.message ?? "";
    if (/prisma|database|ECONN|P\d{4}/i.test(msg)) return { erro: "Não foi possível salvar agora. Confira a conexão e tente de novo em instantes." };
    return { erro: msg || "Não deu para concluir. Tente de novo; se continuar, fale com o suporte." };
  }
}

export function texto(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
