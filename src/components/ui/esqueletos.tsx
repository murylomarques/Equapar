/** Esqueletos com o formato da tela (só aparecem se a espera passar de 400 ms; ver .esqueleto-pagina). */

function Linha({ w, alto }: { w: string; alto?: boolean }) {
  return <span className={`esqueleto${alto ? " alto" : ""}`} style={{ width: w }} />;
}

export function EsqueletoCabecalho() {
  return (
    <div className="pilha-8" style={{ marginBottom: 24 }}>
      <Linha w="120px" />
      <Linha w="280px" alto />
    </div>
  );
}

export function EsqueletoTabela({ linhas = 6, colunas = 6 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="tabela-rolagem" style={{ padding: "0 14px" }}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="fileira" style={{ height: 48, gap: 24, flexWrap: "nowrap", borderBottom: i < linhas - 1 ? "1px solid var(--linha)" : 0 }}>
          {Array.from({ length: colunas }, (_, j) => (
            <span key={j} className="esqueleto" style={{ flex: j === 1 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EsqueletoCartoes({ n = 3, altura = 120 }: { n?: number; altura?: number }) {
  return (
    <div className="cartoes-numero">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="esqueleto-bloco" style={{ height: altura }} />
      ))}
    </div>
  );
}

export function EsqueletoPagina({ children }: { children: React.ReactNode }) {
  return (
    <div className="esqueleto-pagina" role="status" aria-label="Carregando">
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}
