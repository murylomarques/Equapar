import { unstable_rethrow } from "next/navigation";

/** Resultado padrão das ações de servidor: o erro chega ao usuário em texto (também em produção). */
export interface Resultado {
  erro?: string;
  ok?: string;
  dados?: Record<string, unknown>;
}

export type Acao = (anterior: Resultado, fd: FormData) => Promise<Resultado>;

export async function tentar(fn: () => Promise<Resultado | void>): Promise<Resultado> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    const msg = (e as Error)?.message ?? "";
    if (/prisma|database|ECONN|P\d{4}/i.test(msg)) return { erro: "Não foi possível salvar agora. Tente de novo em instantes." };
    return { erro: msg || "Algo deu errado. Tente de novo." };
  }
}

export function texto(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
