"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { BotaoEnvio } from "@/components/botao-envio";
import { completarEmpresa, confirmar2fa, criarConta, entrar, type Estado } from "./acoes";

function Campo({ id, rotulo, erro, ajuda, ...input }: { id: string; rotulo: string; erro?: string; ajuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const desc = [ajuda ? `${id}-ajuda` : "", erro ? `${id}-erro` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} name={id} aria-invalid={!!erro} aria-describedby={desc} {...input} />
      {ajuda && (
        <span id={`${id}-ajuda`} className="ajuda">
          {ajuda}
        </span>
      )}
      {erro && (
        <span id={`${id}-erro`} className="erro">
          {erro}
        </span>
      )}
    </div>
  );
}

export function FormEntrar({ destino, google }: { destino?: string; google: boolean }) {
  const [e, acao] = useActionState<Estado, FormData>(entrar, {});
  return (
    <form action={acao} noValidate>
      <input type="hidden" name="destino" value={destino ?? ""} />
      <Campo id="email" rotulo="E-mail de trabalho" type="email" autoComplete="email" required defaultValue={e.valores?.email} />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" required />
      {e.erro && (
        <p className="erro-texto" role="alert">
          {e.erro}
        </p>
      )}
      <BotaoEnvio className="btn btn-primario" style={{ width: "100%" }} pendente="Entrando…">
        Entrar
      </BotaoEnvio>
      <BotaoGoogle ativo={google} />
    </form>
  );
}

function BotaoGoogle({ ativo }: { ativo: boolean }) {
  if (!ativo)
    return (
      <p className="legenda" style={{ marginTop: 12 }}>
        Entrar com Google fica disponível quando a integração for configurada.
      </p>
    );
  return (
    <a href="/api/auth/google" className="btn" style={{ width: "100%", marginTop: 12 }}>
      Entrar com Google
    </a>
  );
}

export function Form2fa({ destino }: { destino?: string }) {
  const [e, acao] = useActionState<Estado, FormData>(confirmar2fa, {});
  return (
    <form action={acao} noValidate>
      <input type="hidden" name="destino" value={destino ?? ""} />
      <Campo id="codigo" rotulo="Código do aplicativo autenticador" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required erro={e.erro} autoFocus />
      <BotaoEnvio pendente="Conferindo…">Confirmar</BotaoEnvio>
    </form>
  );
}

export function FormCriarConta({ cnpj, tipoInicial, google }: { cnpj?: string; tipoInicial: "EMPRESA" | "ASSESSORIA"; google: boolean }) {
  const [e, acao] = useActionState<Estado, FormData>(criarConta, {});
  const [tipo, setTipo] = useState(e.valores?.tipo ?? tipoInicial);
  const v = e.valores ?? {};
  const err = e.erros ?? {};
  return (
    <form action={acao} noValidate>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
        <legend className="rotulo" style={{ marginBottom: 8 }}>
          A conta é de
        </legend>
        <div className="fileira" style={{ gap: 16 }}>
          <label className="check">
            <input type="radio" name="tipo" value="EMPRESA" checked={tipo === "EMPRESA"} onChange={() => setTipo("EMPRESA")} /> Uma empresa fornecedora
          </label>
          <label className="check">
            <input type="radio" name="tipo" value="ASSESSORIA" checked={tipo === "ASSESSORIA"} onChange={() => setTipo("ASSESSORIA")} /> Uma assessoria com vários clientes
          </label>
        </div>
      </fieldset>
      <Campo id="nome" rotulo="Seu nome" autoComplete="name" required defaultValue={v.nome} erro={err.nome} />
      <Campo id="email" rotulo="E-mail de trabalho" type="email" autoComplete="email" required defaultValue={v.email} erro={err.email} />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="new-password" required erro={err.senha} ajuda="Pelo menos 10 caracteres, com letras e números." />
      <Campo
        id="cnpj"
        rotulo={tipo === "ASSESSORIA" ? "CNPJ do primeiro cliente (opcional)" : "CNPJ da empresa"}
        inputMode="numeric"
        defaultValue={v.cnpj ?? cnpj}
        erro={err.cnpj}
        ajuda={cnpj && tipo === "EMPRESA" ? "Já veio do Raio-X." : undefined}
      />
      <Campo
        id="razaoSocial"
        rotulo={tipo === "ASSESSORIA" ? "Nome da assessoria (aparece nos PDFs)" : "Razão social (opcional)"}
        defaultValue={v.razaoSocial}
        ajuda={tipo === "EMPRESA" ? "Se deixar em branco, usamos a do PNCP." : undefined}
      />
      <label className="check" style={{ marginBottom: 8 }}>
        <input type="checkbox" name="termos" />
        <span>
          Li e aceito os <Link href="/termos">termos de uso</Link> e a <Link href="/privacidade">política de privacidade</Link>.
        </span>
      </label>
      {err.termos && <p className="erro-texto">{err.termos}</p>}
      <p className="legenda">A conta grátis mostra sua carteira e os prazos. Montar pedidos faz parte do piloto ou da assinatura.</p>
      <BotaoEnvio className="btn btn-primario" style={{ width: "100%" }} pendente="Criando…">
        Criar conta
      </BotaoEnvio>
      <BotaoGoogle ativo={google} />
    </form>
  );
}

export function FormEmpresa() {
  const [e, acao] = useActionState<Estado, FormData>(completarEmpresa, {});
  const [tipo, setTipo] = useState("EMPRESA");
  return (
    <form action={acao} noValidate>
      <div className="fileira" style={{ gap: 16, marginBottom: 16 }}>
        <label className="check">
          <input type="radio" name="tipo" value="EMPRESA" checked={tipo === "EMPRESA"} onChange={() => setTipo("EMPRESA")} /> Empresa fornecedora
        </label>
        <label className="check">
          <input type="radio" name="tipo" value="ASSESSORIA" checked={tipo === "ASSESSORIA"} onChange={() => setTipo("ASSESSORIA")} /> Assessoria
        </label>
      </div>
      <Campo id="cnpj" rotulo={tipo === "ASSESSORIA" ? "CNPJ do primeiro cliente (opcional)" : "CNPJ da empresa"} inputMode="numeric" erro={e.erros?.cnpj} />
      <Campo id="razaoSocial" rotulo={tipo === "ASSESSORIA" ? "Nome da assessoria" : "Razão social"} />
      <BotaoEnvio>Continuar</BotaoEnvio>
    </form>
  );
}
