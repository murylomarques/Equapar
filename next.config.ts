import type { NextConfig } from "next";
import { camposFaltando, dadosEmpresa } from "./src/lib/site";

// B1: aviso no build sobre os dados da empresa (SITE_*). Só nomes, nunca valores. Em produção, o que falta não aparece no site.
if (process.argv.includes("build")) {
  const faltam = camposFaltando();
  if (faltam.length) console.warn(`⚠ Site: variáveis vazias (o site esconde ou usa o padrão): ${faltam.join(", ")}.`);
  if (dadosEmpresa().cnpjInvalido) console.warn("⚠ Site: SITE_CNPJ inválido; o CNPJ não aparece no site.");
}

// S3: cabeçalhos de segurança em todas as respostas (a CSP vem do src/proxy.ts, com nonce por requisição).
const cabecalhos = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
  // O sistema é quase todo dinâmico (sessão, banco por requisição); usamos o modelo de cache clássico.
  cacheComponents: false,
  serverExternalPackages: ["exceljs", "pdf-lib", "docx", "nodemailer", "@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
    // A5: CSS em arquivo, não embutido. Embutido, ele ia duas vezes na página (no <style> e de novo no RSC),
    // e o navegador gastava mais tempo lendo scripts antes de pintar o topo no celular.
    inlineCss: false,
  },
};

export default nextConfig;
