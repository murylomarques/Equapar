"use client";
import { useState } from "react";
import Link from "next/link";
import { BotaoEnvio } from "@/components/botao-envio";
import { FormAcao } from "@/components/form-acao";
import { CampoCnpj, CampoSenha, CampoTexto, Consentimento, RadiosCartao } from "@/components/ui/campos";
import { completarEmpresa, confirmar2fa, criarConta, entrar, pedirRedefinicao, redefinirSenha } from "./acoes";

export function FormEntrar({ destino, google }: { destino?: string; google: boolean }) {
  return (
    <FormAcao action={entrar} semToast>
      <input type="hidden" name="destino" value={destino ?? ""} />
      <CampoTexto nome="email" rotulo="E-mail de trabalho" tipo="email" autoComplete="email" id="email" />
      <CampoSenha nome="senha" rotulo="Senha" id="senha" />
      <label className="check" style={{ marginBottom: 20 }}>
        <input type="checkbox" name="lembrar" />
        <span>
          Lembrar de mim neste computador
          <span className="ajuda-texto" style={{ display: "block" }}>
            Sem marcar, a sessão termina em 12 horas ou ao fechar o navegador.
          </span>
        </span>
      </label>
      <BotaoEnvio className="btn btn-primario" style={{ width: "100%" }}>
        Entrar
      </BotaoEnvio>
      {google && (
        <a href="/api/auth/google" className="btn" style={{ width: "100%", marginTop: 12 }}>
          Entrar com Google
        </a>
      )}
    </FormAcao>
  );
}

export function Form2fa({ destino }: { destino?: string }) {
  return (
    <FormAcao action={confirmar2fa} semToast>
      <input type="hidden" name="destino" value={destino ?? ""} />
      <CampoTexto nome="codigo" id="codigo" rotulo="Código do aplicativo autenticador" autoComplete="one-time-code" maxLength={12} largura="curto" autoFocus ajuda="Os 6 números do aplicativo, ou um código de recuperação (ex.: ABCDE-FGH23)" />
      <BotaoEnvio>Confirmar</BotaoEnvio>
    </FormAcao>
  );
}

export function FormCriarConta({ cnpj, tipoInicial, google }: { cnpj?: string; tipoInicial: "EMPRESA" | "ASSESSORIA"; google: boolean }) {
  const [tipo, setTipo] = useState(tipoInicial);
  return (
    <FormAcao action={criarConta} semToast>
      <RadiosCartao
        nome="tipo"
        legenda="A conta é de"
        valorInicial={tipo}
        aoMudar={(v) => setTipo(v as "EMPRESA" | "ASSESSORIA")}
        opcoes={[
          { valor: "EMPRESA", titulo: "Uma empresa fornecedora", descricao: "Seus próprios contratos públicos." },
          { valor: "ASSESSORIA", titulo: "Uma assessoria com vários clientes", descricao: "Contratos de vários fornecedores, com a sua marca nos PDFs." },
        ]}
      />
      <CampoTexto nome="nome" id="nome" rotulo="Seu nome" autoComplete="name" />
      <CampoTexto nome="email" id="email" rotulo="E-mail de trabalho" tipo="email" autoComplete="email" />
      <CampoSenha nome="senha" id="senha" rotulo="Senha" nova />
      <CampoCnpj
        nome="cnpj"
        id="cnpj"
        rotulo={tipo === "ASSESSORIA" ? "CNPJ do primeiro cliente" : "CNPJ da empresa"}
        opcional={tipo === "ASSESSORIA"}
        valorInicial={cnpj}
        ajuda={cnpj && tipo === "EMPRESA" ? "Já veio do Raio-X." : "Pode colar com ou sem pontos."}
      />
      <CampoTexto
        nome="razaoSocial"
        id="razaoSocial"
        rotulo={tipo === "ASSESSORIA" ? "Nome da assessoria" : "Razão social"}
        opcional={tipo === "EMPRESA"}
        ajuda={tipo === "EMPRESA" ? "Se deixar em branco, usamos a razão social publicada no PNCP." : "Aparece nos PDFs que você gerar."}
      />
      <Consentimento nome="termos">
        Li e aceito os <Link href="/termos">termos de uso</Link> e a <Link href="/privacidade">política de privacidade</Link>.
      </Consentimento>
      <p className="ajuda-texto">A conta grátis mostra sua carteira e os prazos. Montar pedidos faz parte do piloto ou da assinatura.</p>
      <BotaoEnvio className="btn btn-primario" style={{ width: "100%" }}>
        Criar conta
      </BotaoEnvio>
      {google && (
        <a href="/api/auth/google" className="btn" style={{ width: "100%", marginTop: 12 }}>
          Criar com Google
        </a>
      )}
    </FormAcao>
  );
}

export function FormEmpresa({ novaConta = false }: { novaConta?: boolean }) {
  const [tipo, setTipo] = useState("EMPRESA");
  return (
    <FormAcao action={completarEmpresa} semToast>
      {novaConta && <input type="hidden" name="novaConta" value="1" />}
      <RadiosCartao
        nome="tipo"
        legenda="A conta é de"
        valorInicial={tipo}
        aoMudar={setTipo}
        opcoes={[
          { valor: "EMPRESA", titulo: "Empresa fornecedora" },
          { valor: "ASSESSORIA", titulo: "Assessoria com vários clientes" },
        ]}
      />
      <CampoCnpj nome="cnpj" rotulo={tipo === "ASSESSORIA" ? "CNPJ do primeiro cliente" : "CNPJ da empresa"} opcional={tipo === "ASSESSORIA"} />
      <CampoTexto nome="razaoSocial" rotulo={tipo === "ASSESSORIA" ? "Nome da assessoria" : "Razão social"} opcional />
      <BotaoEnvio>Continuar</BotaoEnvio>
    </FormAcao>
  );
}

/** S11: pede o link para criar uma senha nova. */
export function FormEsqueciSenha() {
  return (
    <FormAcao action={pedirRedefinicao} semToast okNaPagina>
      <CampoTexto nome="email" rotulo="E-mail da conta" tipo="email" autoComplete="email" />
      <BotaoEnvio>Enviar o link</BotaoEnvio>
    </FormAcao>
  );
}

/** S11: grava a senha nova a partir do link. */
export function FormRedefinirSenha({ token }: { token: string }) {
  return (
    <FormAcao action={redefinirSenha} semToast>
      <input type="hidden" name="t" value={token} />
      <CampoSenha nome="senha" rotulo="Senha nova" nova autoComplete="new-password" />
      <BotaoEnvio>Salvar a senha nova</BotaoEnvio>
    </FormAcao>
  );
}
