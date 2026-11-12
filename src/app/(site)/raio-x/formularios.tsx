"use client";
import { useActionState } from "react";
import Link from "next/link";
import { BotaoEnvio } from "@/components/botao-envio";
import { avisarDepois, pedirRelatorio, type EstadoForm } from "./acoes";

export function FormRelatorio({ cnpj }: { cnpj: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(pedirRelatorio, {});
  if (estado.ok)
    return (
      <div className="aviso-caixa ok" role="status">
        <p>Pronto. Mandamos o relatório para o seu e-mail.</p>
        {estado.link && (
          <a className="btn" href={estado.link}>
            Baixar o relatório em PDF
          </a>
        )}
        <p className="legenda mt-16 mb-0">
          Quer montar o pedido? <Link href={`/criar-conta?cnpj=${cnpj}`}>Criar conta grátis</Link>
        </p>
      </div>
    );
  const e = estado.erros ?? {};
  return (
    <form action={acao} noValidate>
      <input type="hidden" name="cnpj" value={cnpj} />
      <div className="campo">
        <label htmlFor="rel-email">E-mail</label>
        <input id="rel-email" name="email" type="email" autoComplete="email" required aria-invalid={!!e.email} aria-describedby={e.email ? "rel-email-erro" : undefined} />
        {e.email && (
          <span id="rel-email-erro" className="erro">
            {e.email}
          </span>
        )}
      </div>
      <div className="campo">
        <label htmlFor="rel-whats">WhatsApp (opcional)</label>
        <input id="rel-whats" name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" aria-describedby="rel-whats-ajuda" aria-invalid={!!e.whatsapp} />
        <span id="rel-whats-ajuda" className="ajuda">
          WhatsApp, para os avisos de prazo. Nada de propaganda.
        </span>
        {e.whatsapp && <span className="erro">{e.whatsapp}</span>}
      </div>
      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" name="consentimento" />
        <span>Autorizo a Equapar a me mandar avisos de prazo destes contratos. Posso parar a qualquer momento respondendo SAIR.</span>
      </label>
      {e.consentimento && <p className="erro-texto">{e.consentimento}</p>}
      <BotaoEnvio pendente="Enviando…">Enviar relatório</BotaoEnvio>
      <p className="legenda mt-16 mb-0">
        Veja a <Link href="/privacidade">política de privacidade</Link>.
      </p>
    </form>
  );
}

export function FormAvisarDepois({ cnpj }: { cnpj: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(avisarDepois, {});
  if (estado.ok) return <p role="status">{estado.erro ?? "Pronto. A consulta terminou e mandamos o link para o seu e-mail."}</p>;
  return (
    <form action={acao} className="fileira" noValidate>
      <input type="hidden" name="cnpj" value={cnpj} />
      <label htmlFor="av-email" className="sr-only">
        E-mail
      </label>
      <input id="av-email" name="email" type="email" placeholder="seu@email.com.br" style={{ maxWidth: 320 }} aria-invalid={!!estado.erros?.email} />
      <BotaoEnvio className="btn">Avisar por e-mail</BotaoEnvio>
      {estado.erros?.email && <span className="erro-texto">{estado.erros.email}</span>}
    </form>
  );
}
