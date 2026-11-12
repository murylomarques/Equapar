import type { NextConfig } from "next";

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
    // CSS pequeno (~9 KB comprimido): vai junto do HTML e evita uma ida e volta antes da primeira pintura.
    inlineCss: true,
  },
};

export default nextConfig;
