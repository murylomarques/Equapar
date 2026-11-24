"use client";
import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { CampoData, TextoLongo } from "@/components/ui/campos";
import type { Resultado } from "@/lib/acao";
import { registrarProrrogacao } from "../../../acoes";
import { AlertaDeProrrogacao } from "@/components/alerta-prorrogacao";

/** L17: registrar a prorrogação assinada, com ou sem ressalva; alerta de preclusão quando cabe. */
export function RegistrarProrrogacao({ contratoId, ressalvaSugerida, fonte }: { contratoId: string; ressalvaSugerida: string; fonte: { texto: string; url: string; fonte: string } }) {
  const [comRessalva, setComRessalva] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  return (
    <div className="cartao mt-24">
      <h2>Registrar a prorrogação assinada</h2>
      <p className="secundario">Depois de assinar o termo aditivo, registre aqui. O novo fim da vigência passa a valer nos prazos e avisos.</p>
      {typeof resultado?.dados?.alerta === "string" ? <AlertaDeProrrogacao alerta={JSON.parse(resultado.dados.alerta)} fonte={fonte} /> : null}
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
        <BotaoEnvio className="btn">Registrar prorrogação</BotaoEnvio>
      </FormAcao>
    </div>
  );
}
