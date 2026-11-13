import { EsqueletoCabecalho, EsqueletoCartoes, EsqueletoPagina, EsqueletoTabela } from "@/components/ui/esqueletos";

// 5.3: esqueleto com o formato da página (totais e tabelas)
export default function Carregando() {
  return (
    <EsqueletoPagina>
      <EsqueletoCabecalho />
      <EsqueletoCartoes n={2} altura={90} />
      <EsqueletoTabela linhas={4} colunas={3} />
    </EsqueletoPagina>
  );
}
