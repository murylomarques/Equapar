import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { RESPOSTAS_PESQUISA } from "@/lib/metricas";
import { responderPesquisa } from "../acoes";

/** 5.5: pesquisa de Sean Ellis, uma vez por conta ativa há mais de 30 dias. Pode ser dispensada. */
export function PesquisaEncaixe() {
  return (
    <section className="cartao mb-16" aria-labelledby="pesquisa-titulo">
      <h2 id="pesquisa-titulo">Uma pergunta rápida</h2>
      <FormAcao action={responderPesquisa} className="pilha-8">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="mb-8">Como você se sentiria se não pudesse mais usar a Equapar?</legend>
          {Object.entries(RESPOSTAS_PESQUISA).map(([valor, rotulo]) => (
            <label key={valor} className="check">
              <input type="radio" name="resposta" value={valor} />
              <span>{rotulo}</span>
            </label>
          ))}
        </fieldset>
        <div className="campo mb-0">
          <label htmlFor="pesquisa-comentario">Quer contar por quê? (opcional)</label>
          <textarea id="pesquisa-comentario" name="comentario" rows={2} maxLength={1000} />
        </div>
        <div className="fileira">
          <BotaoEnvio className="btn btn-primario">Enviar resposta</BotaoEnvio>
          <BotaoEnvio className="btn btn-discreto" name="dispensar" value="1" pendente="Fechando…">
            Agora não, e não perguntar de novo
          </BotaoEnvio>
        </div>
      </FormAcao>
    </section>
  );
}
