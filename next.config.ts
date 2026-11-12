import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O sistema é quase todo dinâmico (sessão, banco por requisição); usamos o modelo de cache clássico.
  cacheComponents: false,
  serverExternalPackages: ["exceljs", "pdf-lib", "docx", "nodemailer", "@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
