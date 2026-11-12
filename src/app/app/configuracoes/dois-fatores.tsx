"use client";
import { useActionState, useState } from "react";
import type { Resultado } from "@/lib/acao";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { confirmar2faConfig, desativar2fa, iniciar2fa } from "./acoes";

/** Mostra o QR do segredo novo e confirma com o código; depois, os códigos de recuperação (uma vez). */
function Configurar({ svg, uri }: { svg: string; uri: string }) {
  const [conf, confirmar, confirmando] = useActionState<Resultado, FormData>(confirmar2faConfig, {});
  const codigos = conf.dados?.codigos as string[] | undefined;
  if (codigos)
    return (
      <div className="pilha-8" role="status">
        <p>
          <strong>Ativada.</strong> Guarde estes códigos de recuperação num lugar seguro. Cada um entra uma vez, se você ficar sem o celular. Eles não aparecem de novo.
        </p>
        <ul className="lista-limpa" style={{ columns: 2, fontFamily: "ui-monospace, monospace", fontSize: 15 }}>
          {codigos.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button type="button" className="btn btn-pequeno" onClick={() => navigator.clipboard?.writeText(codigos.join("\n"))}>
          Copiar os códigos
        </button>
      </div>
    );
  return (
    <div className="pilha-8">
      <div style={{ width: 200, background: "#fff", padding: 8, border: "1px solid var(--linha)", borderRadius: 6 }} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Código QR para o aplicativo autenticador" />
      <details>
        <summary className="legenda" style={{ cursor: "pointer" }}>
          Não consegue ler? Use o endereço
        </summary>
        <code style={{ wordBreak: "break-all", fontSize: 12 }}>{uri}</code>
      </details>
      <form action={confirmar} className="fileira">
        <label htmlFor="cod-on" className="sr-only">
          Código do aplicativo
        </label>
        <input id="cod-on" name="codigo" inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 números" style={{ maxWidth: 200 }} />
        <button className="btn btn-primario" type="submit" disabled={confirmando}>
          {confirmando ? "Confirmando…" : "Confirmar"}
        </button>
      </form>
      {conf.erro && (
        <p className="erro-texto" role="alert">
          {conf.erro}
        </p>
      )}
    </div>
  );
}

export function DoisFatores({ ativo }: { ativo: boolean }) {
  const [estado, iniciar, pendente] = useActionState<Resultado, FormData>(iniciar2fa, {});
  const [trocando, setTrocando] = useState(false);
  const svg = estado.dados?.svg as string | undefined;
  if (svg) return <Configurar svg={svg} uri={String(estado.dados?.uri)} />;
  if (ativo)
    return (
      <>
        <p>
          <strong>Ativada.</strong> Ao entrar, pedimos o código do aplicativo autenticador.
        </p>
        {trocando ? (
          <form action={iniciar} className="pilha-8">
            <p className="secundario mb-0">Para trocar de aplicativo, confirme que é você: digite o código atual do aplicativo ou a sua senha.</p>
            <div className="fileira">
              <label htmlFor="troca-cod" className="sr-only">
                Código atual ou senha
              </label>
              <input id="troca-cod" name="codigo" inputMode="numeric" placeholder="Código atual" style={{ maxWidth: 160 }} />
              <label htmlFor="troca-senha" className="sr-only">
                Senha
              </label>
              <input id="troca-senha" name="senha" type="password" placeholder="ou a senha" autoComplete="current-password" style={{ maxWidth: 200 }} />
              <button className="btn" type="submit" disabled={pendente}>
                {pendente ? "Conferindo…" : "Continuar"}
              </button>
            </div>
            {estado.erro && (
              <p className="erro-texto" role="alert">
                {estado.erro}
              </p>
            )}
          </form>
        ) : (
          <div className="fileira">
            <button type="button" className="btn" onClick={() => setTrocando(true)}>
              Trocar de aplicativo
            </button>
          </div>
        )}
        <FormAcao action={desativar2fa} className="fileira mt-16">
          <label htmlFor="cod-off" className="sr-only">
            Código atual
          </label>
          <input id="cod-off" name="codigo" inputMode="numeric" placeholder="Código atual" style={{ maxWidth: 160 }} />
          <BotaoEnvio className="btn btn-perigo">Desativar</BotaoEnvio>
        </FormAcao>
      </>
    );
  return (
    <>
      <p className="secundario">Use um aplicativo como Google Authenticator, Microsoft Authenticator ou 1Password.</p>
      <form action={iniciar}>
        <button className="btn" type="submit" disabled={pendente}>
          {pendente ? "Gerando…" : "Ativar verificação em duas etapas"}
        </button>
        {estado.erro && <p className="erro-texto">{estado.erro}</p>}
      </form>
    </>
  );
}
