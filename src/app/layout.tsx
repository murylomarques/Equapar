import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Provedores } from "@/components/ui/provedores";

const sans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "Equapar | Repactuação de contratos públicos de limpeza no prazo",
  description:
    "Veja os prazos dos seus contratos públicos pelo CNPJ e monte o pedido de repactuação com memória de cálculo. Raio-X grátis com dados do PNCP.",
};

export const viewport: Viewport = { themeColor: "#16181D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a className="pular" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
