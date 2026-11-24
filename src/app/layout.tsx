import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { urlSite } from "./(site)/seo";

// A5: a fonte do texto usa "optional": se não chegar a tempo na primeira visita, o texto fica na fonte de reserva
// (ajustada para não deslocar a página) e não espera o download; nas visitas seguintes ela já está em cache.
const sans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "optional" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(urlSite()),
  title: "Equapar | Repactuação de contratos públicos no prazo",
  description:
    "Prazos, memória de cálculo e documentos da repactuação de contratos públicos com mão de obra, do pedido ao recebimento. Raio-X grátis pelo CNPJ com dados do PNCP.",
  applicationName: "Equapar",
  openGraph: { siteName: "Equapar", locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#16181D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a className="pular" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
