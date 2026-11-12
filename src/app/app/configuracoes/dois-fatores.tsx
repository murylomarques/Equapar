"use client";
import { useActionState } from "react";
import type { Resultado } from "@/lib/acao";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { confirmar2faConfig, desativar2fa, iniciar2fa } from "./acoes";

export function DoisFatores({ ativo }: { ativo: boolean }) {
  const [estado, acao, pendente] = useActionState<Resultado>(iniciar2fa, {});
  if (ativo)
    return (
      <>
        <p>
          <strong>Ativada.</strong> Ao entrar, pedimos o código do aplicativo autenticador.
        </p>
        <FormAcao action={desativar2fa} className="fileira">
          <label htmlFor="cod-off" className="sr-only">
            Código atual
          </label>
          <input id="cod-off" name="codigo" inputMode="numeric" placeholder="Código atual" style={{ maxWidth: 160 }} />
          <BotaoEnvio className="btn btn-perigo">Desativar</BotaoEnvio>
        </FormAcao>
      </>
    );
  const svg = estado.dados?.svg as string | undefined;
  return (
    <>
      <p className="secundario">Use um aplicativo como Google Authenticator, Microsoft Authenticator ou 1Password.</p>
      {!svg ? (
        <form action={acao}>
          <button className="btn" type="submit" disabled={pendente}>
            {pendente ? "Gerando…" : "Ativar verificação em duas etapas"}
          </button>
          {estado.erro && <p className="erro-texto">{estado.erro}</p>}
        </form>
      ) : (
        <div className="pilha-8">
          <div style={{ width: 200, background: "#fff", padding: 8, border: "1px solid var(--linha)", borderRadius: 6 }} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Código QR para o aplicativo autenticador" />
          <details>
            <summary className="legenda" style={{ cursor: "pointer" }}>
              Não consegue ler? Use o endereço
            </summary>
            <code style={{ wordBreak: "break-all", fontSize: 12 }}>{String(estado.dados?.uri)}</code>
          </details>
          <FormAcao action={confirmar2faConfig} className="fileira">
            <label htmlFor="cod-on" className="sr-only">
              Código do aplicativo
            </label>
            <input id="cod-on" name="codigo" inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 números" style={{ maxWidth: 200 }} />
            <BotaoEnvio>Confirmar</BotaoEnvio>
          </FormAcao>
        </div>
      )}
    </>
  );
}
