import { EsqueletoCabecalho, EsqueletoCartoes, EsqueletoPagina, EsqueletoTabela } from "@/components/ui/esqueletos";

export default function Carregando() {
  return (
    <EsqueletoPagina>
      <EsqueletoCabecalho />
      <EsqueletoCartoes />
      <EsqueletoTabela linhas={4} colunas={3} />
    </EsqueletoPagina>
  );
}
