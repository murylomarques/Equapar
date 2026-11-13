"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronRight, Info, MoreHorizontal, X } from "lucide-react";

// ============================================================ Alerta

const ICONE_ALERTA = { info: Info, atencao: AlertTriangle, erro: AlertCircle, sucesso: CheckCircle2 };

export function Alerta({
  tipo = "info",
  titulo,
  children,
  acao,
  className = "",
}: {
  tipo?: "info" | "atencao" | "erro" | "sucesso";
  titulo?: React.ReactNode;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  const I = ICONE_ALERTA[tipo];
  return (
    <div className={`alerta alerta-${tipo} ${className}`} role={tipo === "erro" ? "alert" : "status"}>
      <I size={20} strokeWidth={1.5} aria-hidden />
      <div className="alerta-corpo">
        {titulo && <strong>{titulo}</strong>}
        {children && <div>{children}</div>}
      </div>
      {acao}
    </div>
  );
}

// ============================================================ Menu que fecha com Esc e clique fora

export function MenuSuspenso({
  rotulo,
  conteudoBotao,
  className = "btn btn-icone",
  children,
  alinhar = "direita",
}: {
  rotulo: string;
  conteudoBotao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  alinhar?: "direita" | "esquerda";
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    caixa.current?.querySelector<HTMLElement>(".menu-painel a, .menu-painel button")?.focus();
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);
  return (
    <div className="menu" ref={caixa}>
      <button
        ref={botao}
        type="button"
        className={className}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        {conteudoBotao ?? <MoreHorizontal size={20} strokeWidth={1.5} />}
      </button>
      {aberto && (
        <div
          id={id}
          className="menu-painel"
          role="menu"
          style={alinhar === "esquerda" ? { left: 0, right: "auto" } : undefined}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setAberto(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const itens = [...(e.currentTarget.querySelectorAll<HTMLElement>("a, button"))];
            const i = itens.indexOf(document.activeElement as HTMLElement);
            itens[(i + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length]?.focus();
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================ Cabeçalho de página

export function CabecalhoPagina({
  trilha,
  titulo,
  selo,
  subtitulo,
  acao,
  menu,
}: {
  trilha?: { rotulo: string; href?: string }[];
  titulo: React.ReactNode;
  selo?: React.ReactNode;
  subtitulo?: React.ReactNode;
  acao?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <header className="cabecalho-pagina">
      {trilha && trilha.length > 0 && (
        <nav aria-label="Trilha de navegação" className="trilha">
          <ol>
            {trilha.map((t, i) => (
              <li key={i}>
                {t.href ? <Link href={t.href}>{t.rotulo}</Link> : <span aria-current="page">{t.rotulo}</span>}
                {i < trilha.length - 1 && <ChevronRight size={14} strokeWidth={1.5} aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="cabecalho-linha">
        <div style={{ minWidth: 0 }}>
          <div className="fileira" style={{ gap: 12 }}>
            <h1 style={{ margin: 0 }}>{titulo}</h1>
            {selo}
          </div>
          {subtitulo && <p className="secundario mt-8 mb-0">{subtitulo}</p>}
        </div>
        {(acao || menu) && (
          <div className="fileira cabecalho-acoes">
            {acao && <div className="cabecalho-acao">{acao}</div>}
            {menu && (
              <div className="cabecalho-menu">
                <MenuSuspenso rotulo="Mais ações">{menu}</MenuSuspenso>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

// ============================================================ Painel lateral

export function PainelLateral({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      className="painel-lateral"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
    >
      <div className="painel-cab">
        <h2 id={id}>{titulo}</h2>
        <button type="button" className="btn btn-discreto btn-icone" aria-label="Fechar" onClick={aoFechar}>
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>
      <div className="painel-corpo">{children}</div>
      {rodape && <div className="painel-rodape">{rodape}</div>}
    </dialog>
  );
}

// ============================================================ Dica de termo

export const TERMOS: Record<string, string> = {
  repactuação: "Atualização do preço de contratos com mão de obra dedicada quando os custos sobem, por exemplo com uma nova convenção coletiva.",
  apostilamento: "Registro formal da mudança de valor no processo do contrato, sem precisar de termo aditivo. Sem ele, o órgão não paga a diferença.",
  preclusão: "Perda do direito por não ter sido exercido a tempo. Para o TCU, assinar a prorrogação sem pedir a repactuação encerra o direito.",
  "data-base": "Mês em que a categoria negocia os novos pisos na convenção coletiva. A diferença a receber começa a contar a partir dele.",
  ressalva: "Frase no termo aditivo dizendo que a empresa mantém o direito à repactuação, usada quando a convenção ainda não foi depositada.",
};

export function Termo({ children, explicacao }: { children: string; explicacao?: string }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const texto = explicacao ?? TERMOS[children.toLowerCase()] ?? "";
  return (
    <span style={{ position: "relative", display: "inline-block" }} onMouseLeave={() => setAberto(false)}>
      <button
        type="button"
        className="dica"
        aria-describedby={aberto ? id : undefined}
        onMouseEnter={() => setAberto(true)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
      >
        {children}
      </button>
      {aberto && (
        <span id={id} role="tooltip" className="dica-bolha">
          {texto}
        </span>
      )}
    </span>
  );
}

// ============================================================ Indicador de passos

export function Passos({
  passos,
  atual,
  liberados,
  hrefBase,
  estimativa,
}: {
  passos: readonly string[];
  atual: number;
  liberados: number;
  /** Base dos links dos passos já liberados: `${hrefBase}${n}` */
  hrefBase?: string;
  estimativa?: string;
}) {
  return (
    <nav aria-label="Passos" className="passos-nav">
      <p className="legenda mb-0" style={{ marginBottom: 8 }}>
        Passo {atual} de {passos.length}
        <span className="so-celular-inline"> · {passos[atual - 1]}</span>
        {estimativa ? ` · ${estimativa}` : ""}
      </p>
      {/* 5.2: no celular, barra de progresso no lugar da lista de passos (que ficava cortada) */}
      <div className="barra-passos" role="progressbar" aria-label="Progresso do pedido" aria-valuemin={1} aria-valuemax={passos.length} aria-valuenow={atual} aria-valuetext={`Passo ${atual} de ${passos.length}: ${passos[atual - 1]}`}>
        <span style={{ width: `${(atual / passos.length) * 100}%` }} />
      </div>
      <ol className="progresso">
        {passos.map((p, i) => {
          const n = i + 1;
          const feito = n < atual || (n <= liberados && n !== atual && n < liberados);
          const cls = n === atual ? "atual" : n < atual || feito ? "feito" : undefined;
          const conteudo = (
            <>
              <span className="passo-marca" aria-hidden>
                {cls === "feito" ? <Check size={14} strokeWidth={2.5} /> : n}
              </span>
              {p}
              {cls === "feito" && <span className="sr-only"> (concluído)</span>}
            </>
          );
          return (
            <li key={p} className={cls} aria-current={n === atual ? "step" : undefined}>
              {hrefBase && n <= liberados && n !== atual ? <Link href={`${hrefBase}${n}`}>{conteudo}</Link> : <span>{conteudo}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
