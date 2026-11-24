import { SeloSimples, Carimbo } from "./selo";
import { EXEMPLO, valorResumoExemplo } from "@/lib/exemplo-demo";
import { reais } from "@/lib/format";

/** Recortes de tela do produto com dados fictícios (identificados como exemplo), para a landing. */

/**
 * Os três contratos fictícios das prévias (landing e entrada do Raio-X): um conjunto só, com o prazo em dias até o fim
 * da vigência. O 45/2025 usa o mesmo prazo da prévia "Hoje" (EXEMPLO.pedir.diasAteProrrogacao). Sem datas fixas,
 * para a prévia não envelhecer.
 */
export const CONTRATOS_EXEMPLO = [
  { numero: EXEMPLO.pedir.numero, orgao: EXEMPLO.pedir.orgao, dias: EXEMPLO.pedir.diasAteProrrogacao, falta: `${EXEMPLO.pedir.diasAteProrrogacao} dias` },
  { numero: EXEMPLO.protocolado.numero, orgao: EXEMPLO.protocolado.orgao, dias: 4 * 30, falta: "4 meses" },
  { numero: EXEMPLO.deferido.numero, orgao: EXEMPLO.deferido.orgao, dias: 20 * 30, falta: "20 meses" },
] as const;

/** Quantos dos contratos de exemplo terminam nos próximos 6 meses: contado da lista, nunca escrito à mão. */
export const terminamEm6MesesExemplo = () => CONTRATOS_EXEMPLO.filter((c) => c.dias <= 183).length;

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
        Exemplo ilustrativo, com dados de uma empresa fictícia. Os números da demonstração podem ser outros.
      </figcaption>
    </figure>
  );
}

export function PreviaHoje() {
  return (
    <Moldura titulo="Equapar · Hoje">
      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
        Bom dia, {EXEMPLO.usuario}. Próximos 30 dias: {EXEMPLO.prazos30} contratos com prazo, 1 pedido aguardando o órgão e {valorResumoExemplo()} a receber.
      </p>
      <div className="legenda" style={{ fontWeight: 500, color: "var(--tinta)", marginBottom: 6 }}>
        Precisa de você
      </div>
      <div className="cartao" style={{ padding: 12, borderLeft: "3px solid var(--carimbo)" }}>
        <div className="entre">
          <div>
            <strong>Pedir repactuação</strong> · Contrato 45/2025 · Prefeitura Municipal de Exemplo
            <div className="fileira" style={{ marginTop: 6 }}>
              <SeloSimples texto={`prorrogação em ${EXEMPLO.pedir.diasAteProrrogacao} dias`} tom="carimbo" icone="relogio" />
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
          <SeloSimples texto={`Protocolado há ${EXEMPLO.protocolado.diasDesdeProtocolo} dias · prazo preferencial: 1 mês`} tom="azul" icone="ampulheta" />
        </div>
      </div>
    </Moldura>
  );
}

export function PreviaCarteira() {
  const [pedir, protocolado, deferido] = CONTRATOS_EXEMPLO;
  const linhas = [
    [pedir, { t: "Pedir repactuação", tom: "carimbo" as const, i: "relogio" as const }],
    [protocolado, { t: "Aguardando o órgão", tom: "azul" as const, i: "ampulheta" as const }],
    [deferido, { t: "Em dia", tom: "verde" as const, i: "check" as const }],
  ] as const;
  return (
    <Moldura titulo="Equapar · Carteira">
      <table className="tabela" style={{ background: "var(--branco)" }}>
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Órgão</th>
            <th>Fim em</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([c, s]) => (
            <tr key={c.numero}>
              <td>{c.numero}</td>
              <td>{c.orgao}</td>
              <td className="num">{c.falta}</td>
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

/** Memória de cálculo de exemplo, em centavos por posto; a diferença e o total do contrato saem da própria tabela. */
const MEMORIA_EXEMPLO = {
  postos: 42,
  linhas: [
    { item: "Salário base", fonte: "Piso da convenção 2026, cláusula 4ª", antes: 174000, agora: 182000 },
    { item: "INSS", fonte: "20,00% × Módulo 1 + Submódulo 2.1", antes: 42038, agora: 43970 },
    { item: "Demais itens", fonte: "FGTS, provisões, benefícios e insumos", antes: 153062, agora: 156160 },
  ],
} as const;

const centavos = (c: number) => reais((c / 100).toFixed(2));

export function PreviaMemoria() {
  const { postos, linhas } = MEMORIA_EXEMPLO;
  const porPosto = linhas.reduce((t, l) => t + l.agora - l.antes, 0);
  return (
    <Moldura titulo="Equapar · Memória de cálculo">
      <table className="tabela" style={{ background: "var(--branco)" }}>
        <thead>
          <tr>
            <th>Item, por posto</th>
            <th className="num">Antes</th>
            <th className="num">Agora</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.item}>
              <td>
                {l.item}
                <div className="legenda">{l.fonte}</div>
              </td>
              <td className="num">{centavos(l.antes)}</td>
              <td className="num">{centavos(l.agora)}</td>
            </tr>
          ))}
          <tr>
            <td>Diferença por posto, por mês</td>
            <td className="num" />
            <td className="num">{centavos(porPosto)}</td>
          </tr>
          <tr className="total">
            <td>Diferença por mês no contrato ({postos} postos)</td>
            <td className="num" />
            <td className="num">{centavos(porPosto * postos)}</td>
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
      <p style={{ fontWeight: 600, fontSize: 15 }}>{valorResumoExemplo()} deferidos e ainda não recebidos</p>
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
            <td>{EXEMPLO.deferido.numero}</td>
            <td>
              <SeloSimples texto="Sim" tom="verde" />
            </td>
            <td>
              <SeloSimples texto="Falta" tom="ambar" icone="alerta" />
            </td>
            <td className="num">{reais(EXEMPLO.deferido.valor)}</td>
          </tr>
        </tbody>
      </table>
    </Moldura>
  );
}
