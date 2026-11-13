import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { reportarErro } from "./registro";

/** Id da requisição posto pelo proxy (x-request-id), quando houver. */
async function idRequisicao() {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("x-request-id");
  } catch {
    return null;
  }
}

/** Resultado padrão das ações de servidor: o erro chega ao usuário em texto (também em produção). */
export interface Resultado {
  erro?: string;
  /** Erros por campo (chave = name do campo). Mostrados junto ao campo e no resumo de erros. */
  campos?: Record<string, string>;
  ok?: string;
  dados?: Record<string, unknown>;
  /** Pendências que impedem a ação, cada uma com link para onde se resolve. */
  pendencias?: { mensagem: string; href: string; rotulo: string }[];
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

/** Erro com mensagem pensada para a pessoa (curta, em português, com o próximo passo). Chega à tela como está. */
export class ErroUsuario extends Error {}

/** Código curto para a pessoa citar ao suporte; o mesmo código vai no log do servidor. */
function codigoErro() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => a[b % a.length]).join("");
}

/**
 * S9. Roda a ação e traduz erros para a tela. Só chegam como estão os erros pensados para a pessoa
 * (ErroUsuario, ErroCampos). Validação (zod) vira mensagem clara; o resto vira mensagem genérica com
 * um código, e o detalhe técnico fica só no log do servidor, com o mesmo código.
 */
export async function tentar(fn: () => Promise<Resultado | void>): Promise<Resultado> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ErroCampos) return { erro: e.message, campos: e.campos };
    if (e instanceof ErroUsuario) return { erro: e.message };
    const codigo = codigoErro();
    await reportarErro(e, { codigo, requisicao: await idRequisicao(), onde: "acao" });
    if (e instanceof ZodError) return { erro: `Algum dado veio num formato que não esperávamos. Confira o que foi preenchido e tente de novo (código do erro: ${codigo}).` };
    const msg = (e as Error)?.message ?? "";
    if (/prisma|database|ECONN|P\d{4}/i.test(msg)) return { erro: `Não foi possível salvar agora. Confira a conexão e tente de novo em instantes (código do erro: ${codigo}).` };
    return { erro: `Não deu para concluir. Tente de novo; se continuar, fale com o suporte (código do erro: ${codigo}).` };
  }
}

export function texto(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
