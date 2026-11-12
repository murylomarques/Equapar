"use client";
import { BotaoEnvio } from "@/components/botao-envio";
import { FormAcao } from "@/components/form-acao";
import {
  CampoData,
  CampoDinheiro,
  CampoInteiro,
  CampoSelect,
  CampoTexto,
  Combobox,
  Interruptor,
  RadiosCartao,
  SelectUF,
  TextoLongo,
} from "@/components/ui/campos";
import type { Acao, Resultado } from "@/lib/acao";

/** Dados do contrato já serializados (sem Date/Decimal) para o formulário no cliente. */
export interface ContratoForm {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  municipio: string | null;
  uf: string | null;
  esfera: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  dataProposta: string | null;
  postos: number | null;
  valorMensal: string | null;
  ultimoApostilamento: string | null;
  maoDeObraDedicada: boolean;
  tipoReajuste: "REPACTUACAO" | "INDICE";
  convencaoId: string | null;
  clausulaReajuste: string | null;
}

export function FormContrato({
  action,
  contrato: c,
  convencoes,
  empresas,
  empresaId,
  idForm,
  semBotao,
  aoConcluir,
  aoCancelar,
}: {
  action: Acao;
  contrato?: ContratoForm;
  convencoes: { id: string; nome: string; detalhe: string }[];
  empresas: { id: string; razaoSocial: string }[];
  empresaId?: string | null;
  idForm?: string;
  semBotao?: boolean;
  aoConcluir?: (r: Resultado) => void;
  aoCancelar?: () => void;
}) {
  return (
    <FormAcao action={action} id={idForm} aoConcluir={aoConcluir}>
      {c && <input type="hidden" name="id" value={c.id} />}

      <fieldset className="grupo-form">
        <legend>Identificação</legend>
        {!c && empresas.length > 1 && (
          <CampoSelect
            nome="empresaId"
            rotulo="Empresa"
            valorInicial={empresaId ?? ""}
            vazio="Escolha a empresa"
            opcoes={empresas.map((e) => ({ valor: e.id, rotulo: e.razaoSocial }))}
          />
        )}
        {!c && empresas.length === 1 && <input type="hidden" name="empresaId" value={empresas[0].id} />}
        <CampoTexto nome="numero" rotulo="Número do contrato" valorInicial={c?.numero} largura="curto" ajuda="Ex.: 45/2025" />
        <CampoTexto nome="orgao" rotulo="Órgão contratante" valorInicial={c?.orgao} ajuda="Ex.: Prefeitura Municipal de Vitória" />
        <TextoLongo nome="objeto" rotulo="Objeto" valorInicial={c?.objeto} limite={600} ajuda="Como está no contrato." />
        <div className="linha-form" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
          <CampoTexto nome="municipio" rotulo="Cidade" opcional valorInicial={c?.municipio} />
          <SelectUF nome="uf" rotulo="UF" opcional valorInicial={c?.uf} />
          <CampoSelect
            nome="esfera"
            rotulo="Esfera"
            opcional
            valorInicial={c?.esfera ?? ""}
            vazio="—"
            opcoes={[
              { valor: "F", rotulo: "Federal" },
              { valor: "E", rotulo: "Estadual" },
              { valor: "M", rotulo: "Municipal" },
              { valor: "D", rotulo: "Distrital" },
            ]}
          />
        </div>
      </fieldset>

      <fieldset className="grupo-form">
        <legend>Vigência</legend>
        <div className="linha-form">
          <CampoData nome="vigenciaInicio" rotulo="Início da vigência" valorInicial={c?.vigenciaInicio} mostrarRelativo={false} />
          <CampoData nome="vigenciaFim" rotulo="Fim da vigência" valorInicial={c?.vigenciaFim} />
        </div>
        <CampoData
          nome="dataProposta"
          rotulo="Data da proposta"
          opcional
          valorInicial={c?.dataProposta}
          mostrarRelativo={false}
          ajuda="Define se a reforma tributária (LC 214/2025) alcança o contrato."
        />
      </fieldset>

      <fieldset className="grupo-form">
        <legend>Valores</legend>
        <div className="linha-form">
          <CampoInteiro nome="postos" rotulo="Postos de trabalho" opcional valorInicial={c?.postos} sufixo="postos" />
          <CampoDinheiro nome="valorMensal" rotulo="Valor mensal" opcional valorInicial={c?.valorMensal} />
        </div>
        <CampoData nome="ultimoApostilamento" rotulo="Último apostilamento" opcional valorInicial={c?.ultimoApostilamento} mostrarRelativo={false} />
      </fieldset>

      <fieldset className="grupo-form">
        <legend>Reajuste e convenção</legend>
        <Interruptor
          nome="maoDeObraDedicada"
          rotulo="Tem funcionários da empresa trabalhando no órgão"
          descricao="Mão de obra dedicada. Só esses contratos têm repactuação pela convenção coletiva."
          valorInicial={c?.maoDeObraDedicada ?? true}
        />
        <div className="mt-16" />
        <RadiosCartao
          nome="tipoReajuste"
          legenda="Como o preço é atualizado"
          valorInicial={c?.tipoReajuste ?? "REPACTUACAO"}
          opcoes={[
            { valor: "REPACTUACAO", titulo: "Repactuação", descricao: "Pela convenção coletiva da categoria, a cada data-base." },
            { valor: "INDICE", titulo: "Reajuste por índice", descricao: "Por um índice (IPCA, IST…), conforme a cláusula do contrato." },
          ]}
        />
        <Combobox
          nome="convencaoId"
          rotulo="Convenção coletiva"
          opcional
          valorInicial={c?.convencaoId}
          semValor="Não informada"
          opcoes={convencoes.map((v) => ({ valor: v.id, rotulo: v.nome, detalhe: v.detalhe }))}
          vazio="Nenhuma convenção com esse nome. Cadastre em Convenções."
          ajuda="Use a mesma da planilha de custos da proposta."
        />
        <TextoLongo nome="clausulaReajuste" rotulo="Cláusula de reajuste" opcional valorInicial={c?.clausulaReajuste} ajuda="Cole o texto da cláusula. Aparece na decisão de prorrogação." />
      </fieldset>

      {aoCancelar ? (
        <div className="acoes-painel">
          <button type="button" className="btn" onClick={aoCancelar}>
            Cancelar
          </button>
          <BotaoEnvio>Salvar</BotaoEnvio>
        </div>
      ) : (
        !semBotao && <BotaoEnvio>{c ? "Salvar contrato" : "Cadastrar contrato"}</BotaoEnvio>
      )}
    </FormAcao>
  );
}
