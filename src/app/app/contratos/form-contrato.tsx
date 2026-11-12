import type { Contrato, Convencao, Empresa } from "@prisma/client";
import { BotaoEnvio } from "@/components/botao-envio";
import { FormAcao } from "@/components/form-acao";
import type { Acao } from "@/lib/acao";
import { paraInputData } from "@/lib/format";

export function FormContrato({
  action,
  contrato,
  convencoes,
  empresas,
  empresaId,
  somenteLeitura,
}: {
  action: Acao;
  contrato?: Contrato;
  convencoes: Convencao[];
  empresas: Empresa[];
  empresaId?: string | null;
  somenteLeitura?: boolean;
}) {
  const c = contrato;
  return (
    <FormAcao action={action}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <fieldset disabled={somenteLeitura} style={{ border: 0, padding: 0, margin: 0 }}>
        {!c && empresas.length > 1 && (
          <div className="campo">
            <label htmlFor="empresaId">Empresa</label>
            <select id="empresaId" name="empresaId" defaultValue={empresaId ?? ""}>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        )}
        {!c && empresas.length === 1 && <input type="hidden" name="empresaId" value={empresas[0].id} />}
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="numero">Número do contrato</label>
            <input id="numero" name="numero" defaultValue={c?.numero} required placeholder="45/2025" />
          </div>
          <div className="campo" style={{ gridColumn: "span 2" }}>
            <label htmlFor="orgao">Órgão</label>
            <input id="orgao" name="orgao" defaultValue={c?.orgao} required />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="objeto">Objeto</label>
          <textarea id="objeto" name="objeto" defaultValue={c?.objeto} required style={{ minHeight: 64 }} />
        </div>
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="municipio">Cidade</label>
            <input id="municipio" name="municipio" defaultValue={c?.municipio ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="uf">UF</label>
            <input id="uf" name="uf" maxLength={2} defaultValue={c?.uf ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="esfera">Esfera</label>
            <select id="esfera" name="esfera" defaultValue={c?.esfera ?? ""}>
              <option value="">—</option>
              <option value="F">Federal</option>
              <option value="E">Estadual</option>
              <option value="M">Municipal</option>
              <option value="D">Distrital</option>
            </select>
          </div>
        </div>
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="vigenciaInicio">Início da vigência</label>
            <input id="vigenciaInicio" name="vigenciaInicio" type="date" defaultValue={paraInputData(c?.vigenciaInicio)} required />
          </div>
          <div className="campo">
            <label htmlFor="vigenciaFim">Fim da vigência</label>
            <input id="vigenciaFim" name="vigenciaFim" type="date" defaultValue={paraInputData(c?.vigenciaFim)} required />
          </div>
          <div className="campo">
            <label htmlFor="dataProposta">Data da proposta</label>
            <input id="dataProposta" name="dataProposta" type="date" defaultValue={paraInputData(c?.dataProposta)} />
            <span className="ajuda">Define se a reforma tributária (LC 214/2025) alcança o contrato.</span>
          </div>
        </div>
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="postos">Postos</label>
            <input id="postos" name="postos" type="number" min={0} defaultValue={c?.postos ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="valorMensal">Valor mensal (R$)</label>
            <input id="valorMensal" name="valorMensal" inputMode="decimal" defaultValue={c?.valorMensal ? String(c.valorMensal).replace(".", ",") : ""} />
          </div>
          <div className="campo">
            <label htmlFor="ultimoApostilamento">Último apostilamento</label>
            <input id="ultimoApostilamento" name="ultimoApostilamento" type="date" defaultValue={paraInputData(c?.ultimoApostilamento)} />
          </div>
        </div>
        <label className="check" style={{ marginBottom: 16 }}>
          <input type="checkbox" name="maoDeObraDedicada" defaultChecked={c?.maoDeObraDedicada ?? true} />
          Tem funcionários da empresa trabalhando no órgão (mão de obra dedicada)
        </label>
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="tipoReajuste">Como o preço é atualizado</label>
            <select id="tipoReajuste" name="tipoReajuste" defaultValue={c?.tipoReajuste ?? "REPACTUACAO"}>
              <option value="REPACTUACAO">Repactuação (convenção coletiva)</option>
              <option value="INDICE">Reajuste por índice</option>
            </select>
          </div>
          <div className="campo" style={{ gridColumn: "span 2" }}>
            <label htmlFor="convencaoId">Convenção coletiva</label>
            <select id="convencaoId" name="convencaoId" defaultValue={c?.convencaoId ?? ""}>
              <option value="">Não informada</option>
              {convencoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="clausulaReajuste">Cláusula de reajuste (texto)</label>
          <textarea id="clausulaReajuste" name="clausulaReajuste" defaultValue={c?.clausulaReajuste ?? ""} style={{ minHeight: 64 }} />
        </div>
        {!somenteLeitura && <BotaoEnvio pendente="Salvando…">{c ? "Salvar alterações" : "Cadastrar contrato"}</BotaoEnvio>}
      </fieldset>
    </FormAcao>
  );
}
