"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { BotaoEnvio } from "@/components/botao-envio";
import { FormAcao } from "@/components/form-acao";
import { CampoTexto, Consentimento } from "@/components/ui/campos";
import type { Resultado } from "@/lib/acao";
import { avisarDepois, pedirRelatorio } from "./acoes";

export function FormRelatorio({ cnpj }: { cnpj: string }) {
  const [enviado, setEnviado] = useState<Resultado | null>(null);
  if (enviado?.ok)
    return (
      <div role="status">
        <p className="fileira" style={{ fontWeight: 600 }}>
          <CheckCircle2 size={20} strokeWidth={1.5} aria-hidden style={{ color: "var(--verde)" }} /> Relatório enviado
        </p>
        <p className="secundario">Mandamos o relatório para o seu e-mail.</p>
        {enviado.dados?.link ? (
          <a className="btn btn-primario" href={String(enviado.dados.link)} download>
            <Download size={16} strokeWidth={1.5} aria-hidden /> Baixar o PDF agora
          </a>
        ) : null}
        <p className="legenda mt-16 mb-0">
          Quer montar o pedido? <Link href={`/criar-conta?cnpj=${cnpj}`}>Criar conta grátis</Link>
        </p>
      </div>
    );
  return (
    <FormAcao action={pedirRelatorio} semToast aoConcluir={(r) => r.ok && setEnviado(r)}>
      <input type="hidden" name="cnpj" value={cnpj} />
      <CampoTexto nome="email" rotulo="E-mail" tipo="email" autoComplete="email" />
      <CampoTexto nome="whatsapp" rotulo="WhatsApp" opcional tipo="tel" inputMode="tel" autoComplete="tel" ajuda="Só para os avisos de prazo. Nada de propaganda." />
      <Consentimento nome="consentimento">Autorizo a Equapar a me mandar avisos de prazo destes contratos. Posso parar quando quiser, respondendo SAIR.</Consentimento>
      <BotaoEnvio>Enviar relatório</BotaoEnvio>
      <p className="legenda mt-16 mb-0">
        Veja a <Link href="/privacidade">política de privacidade</Link>.
      </p>
    </FormAcao>
  );
}

export function FormAvisarDepois({ cnpj }: { cnpj: string }) {
  const [ok, setOk] = useState<string | null>(null);
  if (ok) return <p role="status">{ok}</p>;
  return (
    <FormAcao action={avisarDepois} semToast aoConcluir={(r) => r.ok && setOk(r.ok)} className="fileira" style={{ alignItems: "flex-end" }}>
      <input type="hidden" name="cnpj" value={cnpj} />
      <div style={{ flex: "1 1 240px" }}>
        <CampoTexto nome="email" rotulo="Seu e-mail" tipo="email" autoComplete="email" className="mb-0" />
      </div>
      <BotaoEnvio className="btn" style={{ marginBottom: 0 }}>
        Avisar por e-mail
      </BotaoEnvio>
    </FormAcao>
  );
}
