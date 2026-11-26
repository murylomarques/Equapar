"use client";
import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { Copiar } from "@/components/copiar";
import { criarLinkConferencia, revogarLinksConferencia } from "../../conferencia-acoes";

/** "Enviar para o contador conferir": cria o link de leitura (14 dias) e permite desativar os já enviados. */
export function ConferenciaLink({ pedidoId, temLinkAtivo }: { pedidoId: string; temLinkAtivo: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <details className="cartao mb-16">
      <summary style={{ cursor: "pointer" }}>Enviar para o contador conferir</summary>
      <p className="ajuda-texto mt-8">
        Crie um link só de leitura: o contador vê esta memória e baixa o PDF e a planilha, sem criar conta. Vale 14 dias e cada abertura fica no histórico do pedido.
      </p>
      <FormAcao action={criarLinkConferencia} aoConcluir={(r) => typeof r.dados?.link === "string" && setLink(r.dados.link)} className="fileira">
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <BotaoEnvio className="btn">Criar link de conferência</BotaoEnvio>
      </FormAcao>
      {link && (
        <div className="pilha-8 mt-16">
          <label>
            Link para o contador
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div>
            <Copiar texto={link} rotulo="Copiar link" />
          </div>
        </div>
      )}
      {(temLinkAtivo || link) && (
        <FormAcao
          action={revogarLinksConferencia}
          aoConcluir={(r) => r.ok && setLink(null)}
          className="mt-16"
          confirmar={{ titulo: "Desativar os links de conferência?", texto: "Todos os links já enviados para este pedido deixam de abrir. Você pode criar um novo depois.", confirmar: "Desativar", perigo: true }}
        >
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <BotaoEnvio className="btn btn-discreto">Desativar links enviados</BotaoEnvio>
        </FormAcao>
      )}
    </details>
  );
}
