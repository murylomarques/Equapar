import type { MetadataRoute } from "next";
import { urlSite } from "./(site)/seo";

// lido a cada requisição: o endereço do site vem do ambiente de execução (APP_URL)
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // área logada, API, links curtos e páginas de link único (senha, convite, confirmação) ficam fora da busca
      disallow: ["/app", "/api", "/r/", "/entrar/2fa", "/redefinir-senha", "/confirmar-email", "/convite"],
    },
    sitemap: `${urlSite()}/sitemap.xml`,
  };
}
