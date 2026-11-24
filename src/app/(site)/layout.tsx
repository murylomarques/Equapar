import "./site.css";
import { RodapeSite, TopoSite } from "./moldura";

// A6/B1: as páginas do site são estáticas e se refazem a cada 60 s com o ambiente de execução (.env da imagem).
// Depois de subir ou mudar uma chave, o site reflete o .env em até 1 minuto. As rotas escondidas valem na hora (proxy).
export const revalidate = 60;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-pagina">
      <TopoSite />
      <main id="conteudo">{children}</main>
      <RodapeSite />
    </div>
  );
}
