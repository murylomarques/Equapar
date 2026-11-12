"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useFormulario } from "./form-acao";
import { useIndicador } from "./ui/espera";

/**
 * Botão de envio com estado de carregamento (5.2):
 * mantém a largura, mostra spinner de 16 px e troca o verbo pelo gerúndio ("Salvar" → "Salvando…"),
 * marca aria-busy e bloqueia o clique duplo.
 */
export function BotaoEnvio({
  children,
  className = "btn btn-primario",
  pendente: textoPendente,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendente?: string }) {
  const { pendente } = useFormulario();
  const visivel = useIndicador(pendente, 0, 500);
  const ref = useRef<HTMLButtonElement>(null);
  const [largura, setLargura] = useState<number | undefined>();
  useLayoutEffect(() => {
    if (!pendente && ref.current) setLargura(ref.current.offsetWidth);
  }, [pendente, children]);
  const ocupado = pendente || visivel;
  return (
    <button
      ref={ref}
      type="submit"
      className={className}
      aria-busy={ocupado}
      aria-disabled={ocupado || undefined}
      style={ocupado && largura ? { minWidth: largura, ...rest.style } : rest.style}
      {...rest}
      onClick={(e) => {
        if (ocupado) e.preventDefault();
        rest.onClick?.(e);
      }}
    >
      {ocupado ? (
        <>
          <span className="spinner" aria-hidden />
          {textoPendente ?? gerundio(children)}
        </>
      ) : (
        children
      )}
    </button>
  );
}

const GERUNDIOS: [RegExp, string][] = [
  [/^Salvar/i, "Salvando…"],
  [/^Enviar/i, "Enviando…"],
  [/^Entrar/i, "Entrando…"],
  [/^Criar/i, "Criando…"],
  [/^Cadastrar/i, "Cadastrando…"],
  [/^Gerar/i, "Gerando…"],
  [/^Registrar/i, "Registrando…"],
  [/^Continuar/i, "Conferindo…"],
  [/^Adicionar/i, "Adicionando…"],
  [/^Importar/i, "Importando…"],
  [/^Confirmar/i, "Confirmando…"],
  [/^Aprovar/i, "Aprovando…"],
  [/^Anexar/i, "Anexando…"],
  [/^Excluir/i, "Excluindo…"],
  [/^Marcar/i, "Marcando…"],
  [/^Montar/i, "Montando…"],
  [/^Trocar/i, "Trocando…"],
  [/^Começar/i, "Começando…"],
  [/^Desativar/i, "Desativando…"],
  [/^Ativar/i, "Ativando…"],
  [/^Concluir/i, "Concluindo…"],
  [/^Encerrar/i, "Encerrando…"],
  [/^Verificar/i, "Verificando…"],
  [/^Atualizar/i, "Atualizando…"],
];

function gerundio(children: React.ReactNode) {
  const t = typeof children === "string" ? children : Array.isArray(children) ? children.filter((c) => typeof c === "string").join("") : "";
  for (const [re, g] of GERUNDIOS) if (re.test(t.trim())) return g;
  return "Aguarde…";
}
