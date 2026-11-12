import { EsqueletoCabecalho, EsqueletoPagina } from "@/components/ui/esqueletos";

export default function Carregando() {
  return (
    <EsqueletoPagina>
      <EsqueletoCabecalho />
      <div className="esqueleto-bloco" style={{ height: 40, marginBottom: 24 }} />
      <div className="esqueleto-bloco" style={{ height: 320 }} />
    </EsqueletoPagina>
  );
}
