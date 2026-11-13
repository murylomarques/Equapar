import { historicoDoOrgao } from "@/lib/historico-orgao";
import { plural } from "@/lib/format";

/** 5.4: o que a própria conta já viveu com este órgão. Nada de outras contas. */
export async function HistoricoOrgao({ contaId, orgao, orgaoCnpj }: { contaId: string; orgao: string; orgaoCnpj: string | null }) {
  const h = await historicoDoOrgao(contaId, { orgao, orgaoCnpj });
  return (
    <section className="cartao historico-orgao" aria-labelledby="hist-orgao">
      <h2 id="hist-orgao">Sua história com este órgão</h2>
      {h.feitos === 0 ? (
        <p className="secundario mb-0">Nenhum pedido protocolado com este órgão ainda.</p>
      ) : (
        <dl className="dl-resumo mb-0">
          <dt>Pedidos protocolados</dt>
          <dd>
            {h.feitos} · {plural(h.deferidos, "deferido", "deferidos")} · {plural(h.indeferidos, "indeferido", "indeferidos")}
          </dd>
          <dt>Tempo médio até a resposta</dt>
          <dd>{h.diasAteResposta != null ? plural(h.diasAteResposta, "dia", "dias") : <span className="secundario">sem resposta registrada</span>}</dd>
          <dt>Tempo médio até o apostilamento</dt>
          <dd>{h.diasAteApostilamento != null ? plural(h.diasAteApostilamento, "dia", "dias") : <span className="secundario">sem apostilamento registrado</span>}</dd>
        </dl>
      )}
      <p className="legenda mb-0 mt-8">Só pedidos desta conta{orgaoCnpj ? ", pelo CNPJ do órgão" : ", pelo nome do órgão (sem CNPJ cadastrado)"}.</p>
    </section>
  );
}
