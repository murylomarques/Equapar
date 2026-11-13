import type { MetadataRoute } from "next";
import { GUIAS } from "@/lib/guias";
import { guiaNoAr, modoPiloto } from "@/lib/chaves";

// A6: o mapa do site só lista o que está no ar (as chaves valem pelo ambiente de execução)
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "https://equapar.com").replace(/\/$/, "");
  const rotas = ["/", "/raio-x", "/precos", "/guias", "/metodo/levantamento-limpeza", "/demonstracao", "/privacidade", "/termos", ...(modoPiloto() ? [] : ["/assessorias"])];
  return [...rotas, ...GUIAS.filter((g) => guiaNoAr(g.slug)).map((g) => `/guias/${g.slug}`)].map((r) => ({ url: `${base}${r}` }));
}
