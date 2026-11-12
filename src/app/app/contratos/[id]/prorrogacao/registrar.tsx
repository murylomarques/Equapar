"use client";
import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CampoData, TextoLongo } from "@/components/ui/campos";
import { Alerta } from "@/components/ui/estrutura";
import type { Resultado } from "@/lib/acao";
import { registrarProrrogacao } from "../../../acoes";

/** L17: registrar a prorrogação assinada, com ou sem ressalva; alerta de preclusão quando cabe. */
export function RegistrarProrrogacao({ contratoId, ressalvaSugerida, fonte }: { contratoId: string; ressalvaSugerida: string; fonte: { texto: string; url: string; fonte: string } }) {
  const [comRessalva, setComRessalva] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  return (
    <div className="cartao mt-24">
      <h2>Registrar a prorrogação assinada</h2>
      <p className="secundario">Depois de assinar o termo aditivo, registre aqui. O novo fim da vigência passa a valer nos prazos e avisos.</p>
      {resultado?.dados?.preclusao ? (
        <Alerta tipo="erro" titulo="Atenção: risco de perder a repactuação" className="mb-16">
          A prorrogação foi assinada sem pedido de repactuação protocolado e sem ressalva, com uma convenção nova já depositada. O TCU entende que, nesse caso, o direito pode ter
          precluído. Fale com o seu jurídico. {fonte.texto} Fonte:{" "}
          <a href={fonte.url} target="_blank" rel="noopener noreferrer">
            {fonte.fonte}
          </a>
          .
        </Alerta>
      ) : null}
      <FormAcao action={registrarProrrogacao} aoConcluir={(r) => setResultado(r)}>
        <input type="hidden" name="contratoId" value={contratoId} />
        <div className="linha-form">
          <CampoData nome="dataTermo" rotulo="Data de assinatura do termo aditivo" mostrarRelativo={false} />
          <CampoData nome="novoFim" rotulo="Novo fim da vigência" />
        </div>
        <label className="check mb-16">
          <input type="checkbox" name="comRessalva" checked={comRessalva} onChange={(e) => setComRessalva(e.target.checked)} />
          <span>O termo aditivo tem ressalva do direito à repactuação</span>
        </label>
        {comRessalva && <TextoLongo nome="textoRessalva" rotulo="Texto da ressalva, como ficou no termo" valorInicial={ressalvaSugerida} limite={1000} />}
        <BotaoEnvio>Registrar prorrogação</BotaoEnvio>
      </FormAcao>
    </div>
  );
}
