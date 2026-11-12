import "server-only";
import { db } from "./db";
import { soDigitos } from "./cnpj";
import { hojeUTC } from "./format";

/**
 * Consulta pública ao PNCP (somente leitura). Usa a busca do portal, filtrando pelo CNPJ do fornecedor.
 * A API de consulta não filtra por fornecedor (TabNews, citado no Dossiê), por isso a busca + filtro local.
 * Registros de pessoa física (CPF) são descartados na entrada (LGPD).
 */

export interface ContratoPncp {
  controle: string;
  numero: string;
  orgao: string;
  orgaoCnpj: string;
  uf: string | null;
  municipio: string | null;
  esfera: string | null;
  objeto: string;
  inicio: string; // AAAA-MM-DD
  fim: string;
  valorGlobal: number | null;
  link: string;
  sugereMaoDeObra: boolean;
}

export interface ResultadoRaioX {
  cnpj: string;
  razaoSocial: string | null;
  contratos: ContratoPncp[];
  consultadoEm: string;
  fonte: "pncp" | "cache";
}

export class PncpIndisponivel extends Error {}

const BASE = "https://pncp.gov.br/api/search/";
const CACHE_HORAS = 6;
const TERMOS_MAO_DE_OBRA =
  /limpeza|conserva[cç][aã]o|asseio|higieniza|copeir|portaria|porteiro|vigil[aâ]ncia|recep[cç][aã]o|m[aã]o de obra|dedica[cç][aã]o exclusiva|terceiriza|postos? de trabalho|servi[cç]os? cont[ií]nuos?|jardinagem|zeladoria|apoio administrativo/i;

export function sugereMaoDeObra(objeto: string) {
  return TERMOS_MAO_DE_OBRA.test(objeto ?? "");
}

type ItemBusca = Record<string, unknown>;

async function buscarPagina(cnpj: string, pagina: number, sinal: AbortSignal) {
  const url = `${BASE}?q=${cnpj}&tipos_documento=contrato&ordenacao=-data&pagina=${pagina}&tam_pagina=100&status=vigente`;
  // O firewall do PNCP derruba conexões sem User-Agent (ECONNRESET). Cliente genérico, sem dado pessoal.
  const r = await fetch(url, {
    signal: sinal,
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; EquaparBot/1.0; +https://equapar.com.br)" },
    cache: "no-store",
  });
  if (!r.ok) throw new PncpIndisponivel(`PNCP respondeu ${r.status}`);
  return (await r.json()) as { items: ItemBusca[]; total: number };
}

function s(v: unknown) {
  return v == null ? null : String(v);
}

export async function consultarPncp(cnpjEntrada: string, opts: { semCache?: boolean; timeoutMs?: number } = {}): Promise<ResultadoRaioX> {
  const cnpj = soDigitos(cnpjEntrada);
  if (!opts.semCache) {
    const c = await db.raioXCache.findUnique({ where: { cnpj } });
    if (c && Date.now() - c.consultadoEm.getTime() < CACHE_HORAS * 3_600_000) {
      return { ...(c.resultado as unknown as ResultadoRaioX), fonte: "cache" };
    }
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  const itens: ItemBusca[] = [];
  try {
    for (let p = 1; p <= 5; p++) {
      const { items, total } = await buscarPagina(cnpj, p, ctrl.signal);
      itens.push(...(items ?? []));
      if (!items?.length || itens.length >= total) break;
    }
  } catch (e) {
    if (e instanceof PncpIndisponivel) throw e;
    throw new PncpIndisponivel((e as Error).message);
  } finally {
    clearTimeout(t);
  }

  const hoje = hojeUTC().toISOString().slice(0, 10);
  let razaoSocial: string | null = null;
  const vistos = new Set<string>();
  const contratos: ContratoPncp[] = [];
  for (const it of itens) {
    if (soDigitos(s(it.fornecedor_ni) ?? "") !== cnpj) continue;
    if (s(it.fornecedor_tipo_pessoa) !== "PJ") continue; // descarta pessoa física
    if (it.cancelado === true) continue;
    const fim = s(it.data_fim_vigencia)?.slice(0, 10);
    if (!fim || fim < hoje) continue;
    const controle = s(it.numero_controle_pncp) ?? s(it.id)!;
    if (vistos.has(controle)) continue;
    vistos.add(controle);
    razaoSocial ??= s(it.fornecedor_nome);
    const objeto = (s(it.description) ?? "").trim();
    contratos.push({
      controle,
      numero: s(it.numero_contrato_empenho) ?? s(it.title)?.replace(/^Contrato n[ºo°]\s*/i, "") ?? controle,
      orgao: s(it.orgao_nome) ?? "Órgão não informado",
      orgaoCnpj: s(it.orgao_cnpj) ?? "",
      uf: s(it.uf),
      municipio: s(it.municipio_nome),
      esfera: s(it.esfera_id),
      objeto,
      inicio: s(it.data_inicio_vigencia)?.slice(0, 10) ?? s(it.data_assinatura)?.slice(0, 10) ?? fim,
      fim,
      valorGlobal: typeof it.valor_global === "number" ? it.valor_global : null,
      link: it.item_url ? `https://pncp.gov.br/app${s(it.item_url)}` : "https://pncp.gov.br",
      sugereMaoDeObra: sugereMaoDeObra(objeto),
    });
  }
  contratos.sort((a, b) => a.fim.localeCompare(b.fim));

  const resultado: ResultadoRaioX = { cnpj, razaoSocial, contratos, consultadoEm: new Date().toISOString(), fonte: "pncp" };
  await db.raioXCache.upsert({
    where: { cnpj },
    create: { cnpj, resultado: resultado as object },
    update: { resultado: resultado as object, consultadoEm: new Date() },
  });
  return resultado;
}
