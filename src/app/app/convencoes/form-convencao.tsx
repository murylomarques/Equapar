"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { AreaArquivo } from "@/components/ui/arquivo";
import { CampoData, CampoInteiro, CampoTexto, SelectMes, SelectUF } from "@/components/ui/campos";
import { PainelLateral } from "@/components/ui/estrutura";
import { salvarConvencao } from "../acoes";

export interface ConvencaoForm {
  id: string;
  nome: string;
  sindicatos: string | null;
  cidade: string | null;
  uf: string;
  ano: number;
  mesDataBase: number;
  dataDeposito: string | null;
  registroMte: string | null;
}

function Campos({ c }: { c?: ConvencaoForm }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <fieldset className="grupo-form">
        <legend>Identificação</legend>
        <CampoTexto nome="nome" rotulo="Nome" valorInicial={c?.nome} ajuda="Ex.: CCT Asseio e Conservação ES 2026" />
        <CampoTexto nome="sindicatos" rotulo="Sindicatos" opcional valorInicial={c?.sindicatos} ajuda="Patronal e laboral, como estão na convenção." />
      </fieldset>
      <fieldset className="grupo-form">
        <legend>Base territorial e data-base</legend>
        <div className="linha-form" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
          <CampoTexto nome="cidade" rotulo="Cidade" opcional valorInicial={c?.cidade} />
          <SelectUF nome="uf" rotulo="UF" valorInicial={c?.uf} />
        </div>
        <div className="linha-form">
          <SelectMes nome="mesDataBase" rotulo="Mês da data-base" valorInicial={c?.mesDataBase} />
          <CampoInteiro nome="ano" rotulo="Ano" valorInicial={c?.ano ?? new Date().getFullYear()} largura="curto" />
        </div>
      </fieldset>
      <fieldset className="grupo-form">
        <legend>Registro no Ministério do Trabalho</legend>
        <div className="linha-form">
          <CampoData nome="dataDeposito" rotulo="Data do depósito (Mediador)" opcional valorInicial={c?.dataDeposito} mostrarRelativo={false} ajuda="Em branco = convenção ainda pendente." />
          <CampoTexto nome="registroMte" rotulo="Número do registro" opcional valorInicial={c?.registroMte} />
        </div>
        <span className="rotulo">
          PDF da convenção <span className="opcional">(opcional)</span>
        </span>
        <div className="mt-8">
          <AreaArquivo tipos={["pdf"]} limiteMb={15} />
        </div>
      </fieldset>
    </>
  );
}

export function NovaConvencao() {
  return (
    <FormAcao action={salvarConvencao} limparAoSalvar>
      <Campos />
      <BotaoEnvio>Cadastrar convenção</BotaoEnvio>
    </FormAcao>
  );
}

export function EditarConvencao({ c }: { c: ConvencaoForm }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-pequeno" onClick={() => setAberto(true)}>
        <Pencil size={14} strokeWidth={1.5} aria-hidden /> Editar
      </button>
      <PainelLateral aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Editar ${c.nome}`}>
        {aberto && (
          <FormAcao action={salvarConvencao} aoConcluir={(r) => r.ok && setAberto(false)}>
            <Campos c={c} />
            <div className="acoes-painel">
              <button type="button" className="btn" onClick={() => setAberto(false)}>
                Cancelar
              </button>
              <BotaoEnvio>Salvar</BotaoEnvio>
            </div>
          </FormAcao>
        )}
      </PainelLateral>
    </>
  );
}
