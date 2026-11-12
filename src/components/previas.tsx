import { SeloSimples, Carimbo } from "./selo";

/** Recortes de tela do produto com dados fictícios (identificados como exemplo), para a landing. */

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <figure className="tela-previa" style={{ margin: 0 }}>
      <div className="tela-previa-barra" aria-hidden>
        <i />
        <i />
        <i />
        <span className="legenda" style={{ marginLeft: 8 }}>
          {titulo}
        </span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
      <figcaption className="legenda" style={{ padding: "0 16px 12px" }}>
        Tela real da Equapar com dados de uma empresa fictícia, usada como exemplo.
      </figcaption>
    </figure>
  );
}

export function PreviaHoje() {
  return (
    <Moldura titulo="Equapar · Hoje">
      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
        Bom dia, Juliana. Esta semana: 2 prazos, 1 pedido aguardando o órgão e R$ 48,3 mil a receber.
      </p>
      <div className="legenda" style={{ fontWeight: 500, color: "var(--tinta)", marginBottom: 6 }}>
        Precisa de você
      </div>
      <div className="cartao" style={{ padding: 12, borderLeft: "3px solid var(--carimbo)" }}>
        <div className="entre">
          <div>
            <strong>Pedir repactuação</strong> · Contrato 45/2025 · Prefeitura Municipal de Exemplo
            <div className="fileira" style={{ marginTop: 6 }}>
              <SeloSimples texto="prorrogação em 18 dias" tom="carimbo" icone="relogio" />
            </div>
          </div>
          <span className="btn btn-primario btn-pequeno" aria-hidden>
            Montar pedido
          </span>
        </div>
      </div>
      <div className="cartao" style={{ padding: 12, marginTop: 8 }}>
        <strong>Aguardando o órgão</strong> · Contrato 12/2024 · Tribunal Regional Exemplo
        <div style={{ marginTop: 6 }}>
          <SeloSimples texto="Protocolado há 21 dias · prazo preferencial: 1 mês" tom="azul" icone="ampulheta" />
        </div>
      </div>
    </Moldura>
  );
}

export function PreviaCarteira() {
  const linhas = [
    ["45/2025", "Prefeitura Municipal de Exemplo", "18/12/2026", { t: "Pedir até 18/12/2026", tom: "carimbo" as const, i: "relogio" as const }],
    ["12/2024", "Tribunal Regional Exemplo", "03/2027", { t: "Aguardando o órgão", tom: "azul" as const, i: "ampulheta" as const }],
    ["07/2025", "Universidade Federal Exemplo", "08/2027", { t: "Em dia", tom: "verde" as const, i: "check" as const }],
  ] as const;
  return (
    <Moldura titulo="Equapar · Carteira">
      <table className="tabela" style={{ background: "var(--branco)" }}>
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Órgão</th>
            <th>Fim</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([n, o, f, s]) => (
            <tr key={n}>
              <td>{n}</td>
              <td>{o}</td>
              <td className="num">{f}</td>
              <td>
                <SeloSimples texto={s.t} tom={s.tom} icone={s.i} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Moldura>
  );
}

export function PreviaMemoria() {
  return (
    <Moldura titulo="Equapar · Memória de cálculo">
      <table className="tabela" style={{ background: "var(--branco)" }}>
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Antes</th>
            <th className="num">Agora</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Salário base
              <div className="legenda">Piso da convenção 2026, cláusula 4ª</div>
            </td>
            <td className="num">R$ 1.740,00</td>
            <td className="num">R$ 1.820,00</td>
          </tr>
          <tr>
            <td>
              INSS
              <div className="legenda">20,00% × Módulo 1 + Submódulo 2.1</div>
            </td>
            <td className="num">R$ 420,38</td>
            <td className="num">R$ 439,70</td>
          </tr>
          <tr className="total">
            <td>Diferença por mês</td>
            <td className="num" />
            <td className="num">R$ 4.212,60</td>
          </tr>
        </tbody>
      </table>
    </Moldura>
  );
}

export function PreviaPronto() {
  return (
    <Moldura titulo="Equapar · Pedido pronto">
      <div className="entre" style={{ marginBottom: 12 }}>
        <strong>Contrato 45/2025 · Prefeitura Municipal de Exemplo</strong>
        <Carimbo texto="PRONTO PARA PROTOCOLAR" />
      </div>
      <ul className="lista-limpa pilha-8">
        <li>Ofício (Word e PDF)</li>
        <li>Planilha (Excel)</li>
        <li>Memória de cálculo (PDF)</li>
        <li>Anexos (ZIP)</li>
      </ul>
    </Moldura>
  );
}

export function PreviaReceber() {
  return (
    <Moldura titulo="Equapar · A receber">
      <p style={{ fontWeight: 600, fontSize: 15 }}>R$ 48,3 mil deferidos e ainda não recebidos</p>
      <table className="tabela" style={{ background: "var(--branco)" }}>
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Apostilado</th>
            <th>Faturado</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>12/2024</td>
            <td>
              <SeloSimples texto="Sim" tom="verde" />
            </td>
            <td>
              <SeloSimples texto="Falta" tom="ambar" icone="alerta" />
            </td>
            <td className="num">R$ 31.540,20</td>
          </tr>
        </tbody>
      </table>
    </Moldura>
  );
}
