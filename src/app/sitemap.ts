import type { MetadataRoute } from "next";
import { GUIAS } from "@/lib/guias";
import { guiaNoAr, modoPiloto } from "@/lib/chaves";
import { urlSite } from "./(site)/seo";

// A6: o mapa do site só lista o que está no ar (as chaves valem pelo ambiente de execução)
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlSite();
  const rotas: [string, number][] = [
    ["/", 1],
    ["/raio-x", 0.9],
    ["/software-de-repactuacao", 0.8],
    ["/precos", 0.8],
    ["/guias", 0.7],
    ["/demonstracao", 0.6],
    ["/metodo/levantamento-limpeza", 0.4],
    ["/privacidade", 0.2],
    ["/termos", 0.2],
    // escondida no modo piloto (404): só entra no mapa com o modo desligado
    ...(modoPiloto() ? [] : ([["/assessorias", 0.6]] as [string, number][])),
    ...GUIAS.filter((g) => guiaNoAr(g.slug) && g.revisao !== "pendente").map((g) => [`/guias/${g.slug}`, 0.7] as [string, number]),
  ];
  return rotas.map(([r, priority]) => ({ url: `${base}${r}`, priority }));
}
