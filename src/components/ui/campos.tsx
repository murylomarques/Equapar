"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { useErroCampo } from "../form-acao";
import {
  diasEntre,
  erroCnpj,
  exibirDinheiro,
  exibirPercentual,
  isoParaBr,
  mascaraCnpj,
  mascaraData,
  mascaraDinheiroDigitando,
  parseData,
  parseDinheiro,
  parseInteiro,
  parsePercentual,
  relativo,
  soDigitos,
} from "@/lib/mascaras";

// ============================================================ Invólucro

interface BaseProps {
  nome: string;
  rotulo: React.ReactNode;
  ajuda?: React.ReactNode;
  opcional?: boolean;
  erro?: string;
  id?: string;
  largura?: "uf" | "data" | "cnpj" | "dinheiro" | "curto" | "medio";
  className?: string;
  desabilitado?: boolean;
}

function useIds(nome: string, id?: string) {
  const auto = useId();
  const base = id ?? `campo-${nome}-${auto.replace(/:/g, "")}`;
  return { id: base, ajudaId: `${base}-ajuda`, erroId: `${base}-erro` };
}

export function Campo({
  id,
  rotulo,
  ajuda,
  opcional,
  erro,
  ajudaId,
  erroId,
  largura,
  className,
  children,
  extra,
}: {
  id: string;
  rotulo: React.ReactNode;
  ajuda?: React.ReactNode;
  opcional?: boolean;
  erro?: string | null;
  ajudaId: string;
  erroId: string;
  largura?: BaseProps["largura"];
  className?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`campo${className ? ` ${className}` : ""}`}>
      <label htmlFor={id} className="rotulo">
        {rotulo}
        {opcional && <span className="opcional"> (opcional)</span>}
      </label>
      <div className={largura ? `w-${largura}` : undefined}>{children}</div>
      {extra}
      {ajuda && !erro && (
        <span id={ajudaId} className="ajuda">
          {ajuda}
        </span>
      )}
      {erro && (
        <span id={erroId} className="erro">
          <AlertCircle size={16} strokeWidth={1.5} aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
          {erro}
        </span>
      )}
    </div>
  );
}

function descricao(ajuda: unknown, erro: unknown, ids: { ajudaId: string; erroId: string }) {
  return erro ? ids.erroId : ajuda ? ids.ajudaId : undefined;
}

// ============================================================ Texto

export function CampoTexto({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  largura,
  className,
  desabilitado,
  tipo = "text",
  valorInicial,
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  autoFocus,
  aoMudar,
}: BaseProps & {
  tipo?: "text" | "email" | "tel" | "search" | "url";
  valorInicial?: string | null;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  aoMudar?: (v: string) => void;
}) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [valor, setValor] = useState(valorInicial ?? "");
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura={largura} className={className}>
      <input
        id={ids.id}
        name={nome}
        data-campo={nome}
        type={tipo}
        value={valor}
        disabled={desabilitado}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-invalid={!!erro}
        aria-describedby={descricao(ajuda, erro, ids)}
        onChange={(e) => {
          setValor(e.target.value);
          if (erroLocal) setErroLocal(null);
          aoMudar?.(e.target.value);
        }}
        onBlur={() => {
          if (tipo === "email" && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) setErroLocal("Confira o e-mail: falta o @ ou o domínio (ex.: nome@empresa.com.br).");
        }}
      />
    </Campo>
  );
}

// ============================================================ Senha

const REGRAS_SENHA = [
  { texto: "Pelo menos 10 caracteres", ok: (s: string) => s.length >= 10 },
  { texto: "Letras", ok: (s: string) => /[A-Za-zÀ-ÿ]/.test(s) },
  { texto: "Números", ok: (s: string) => /\d/.test(s) },
];

export function CampoSenha({
  nome,
  rotulo,
  erro: erroProp,
  id,
  nova,
  autoComplete,
  ajuda,
}: Omit<BaseProps, "largura"> & { nova?: boolean; autoComplete?: string }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [ver, setVer] = useState(false);
  const [valor, setValor] = useState("");
  const erro = erroProp ?? erroServidor ?? null;
  const regrasId = `${ids.id}-regras`;
  return (
    <Campo
      {...ids}
      rotulo={rotulo}
      ajuda={ajuda}
      erro={erro}
      extra={
        nova ? (
          <ul id={regrasId} className="lista-limpa fileira" style={{ gap: 12, font: "var(--t-ajuda)" }} aria-live="polite">
            {REGRAS_SENHA.map((r) => {
              const ok = r.ok(valor);
              return (
                <li key={r.texto} className="fileira" style={{ gap: 4, color: ok ? "var(--verde)" : "var(--grafite)" }}>
                  {ok ? <Check size={14} strokeWidth={2} aria-hidden /> : <span aria-hidden style={{ width: 14, textAlign: "center" }}>·</span>}
                  {r.texto}
                  <span className="sr-only">{ok ? " (cumprida)" : " (falta)"}</span>
                </li>
              );
            })}
          </ul>
        ) : null
      }
    >
      <div className="entrada com-botao">
        <input
          id={ids.id}
          name={nome}
          data-campo={nome}
          type={ver ? "text" : "password"}
          value={valor}
          autoComplete={autoComplete ?? (nova ? "new-password" : "current-password")}
          aria-invalid={!!erro}
          aria-describedby={[descricao(ajuda, erro, ids), nova ? regrasId : ""].filter(Boolean).join(" ") || undefined}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="button" className="botao-dentro" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder a senha" : "Mostrar a senha"} aria-pressed={ver}>
          {ver ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
        </button>
      </div>
    </Campo>
  );
}

// ============================================================ CNPJ

export function CampoCnpj({
  nome,
  rotulo = "CNPJ",
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  className,
  autoFocus,
}: Omit<BaseProps, "rotulo" | "largura"> & { rotulo?: React.ReactNode; valorInicial?: string | null; autoFocus?: boolean }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [valor, setValor] = useState(mascaraCnpj(valorInicial ?? ""));
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const valido = soDigitos(valor).length === 14 && !erroCnpj(valor);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura="cnpj" className={className}>
      <div className="entrada">
        <input
          id={ids.id}
          data-campo={nome}
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          autoFocus={autoFocus}
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda, erro, ids)}
          onChange={(e) => {
            setValor(mascaraCnpj(e.target.value));
            if (erroLocal) setErroLocal(null);
          }}
          onBlur={() => {
            if (!valor && opcional) return setErroLocal(null);
            if (soDigitos(valor).length > 0) setErroLocal(erroCnpj(valor));
          }}
        />
        {valido && <Check className="icone-ok" size={18} strokeWidth={2} aria-label="CNPJ válido" />}
      </div>
      <input type="hidden" name={nome} value={soDigitos(valor)} />
    </Campo>
  );
}

// ============================================================ Dinheiro

export function CampoDinheiro({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  className,
  desabilitado,
}: Omit<BaseProps, "largura"> & { valorInicial?: string | number | null }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [valor, setValor] = useState(valorInicial != null && valorInicial !== "" ? exibirDinheiro(parseDinheiro(String(valorInicial).replace(".", ","))) : "");
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const canonico = parseDinheiro(valor);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura="dinheiro" className={className}>
      <div className="entrada com-prefixo">
        <span className="prefixo" aria-hidden>
          R$
        </span>
        <input
          id={ids.id}
          data-campo={nome}
          type="text"
          inputMode="decimal"
          className="valor-num"
          value={valor}
          disabled={desabilitado}
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda, erro, ids)}
          onChange={(e) => {
            setValor(mascaraDinheiroDigitando(e.target.value));
            if (erroLocal) setErroLocal(null);
          }}
          onBlur={() => {
            if (!valor) return;
            const c = parseDinheiro(valor);
            if (!c) setErroLocal("Digite um valor em reais, por exemplo 48.300,00.");
            else setValor(exibirDinheiro(c));
          }}
        />
      </div>
      <input type="hidden" name={nome} value={canonico ?? (valor ? valor : "")} />
    </Campo>
  );
}

// ============================================================ Percentual

export function CampoPercentual({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  casas = 2,
}: Omit<BaseProps, "largura"> & { valorInicial?: string | null; casas?: number }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [valor, setValor] = useState(exibirPercentual(valorInicial));
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura="curto">
      <div className="entrada com-sufixo">
        <input
          id={ids.id}
          data-campo={nome}
          type="text"
          inputMode="decimal"
          className="valor-num"
          value={valor}
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda, erro, ids)}
          onChange={(e) => {
            setValor(e.target.value.replace(/[^\d,.-]/g, ""));
            if (erroLocal) setErroLocal(null);
          }}
          onBlur={() => {
            if (valor && !parsePercentual(valor, casas)) setErroLocal(`Digite um percentual com até ${casas} casas, por exemplo 8,33.`);
          }}
          style={{ paddingRight: 36 }}
        />
        <span className="sufixo" aria-hidden>
          %
        </span>
      </div>
      <input type="hidden" name={nome} value={parsePercentual(valor, casas) ?? valor} />
    </Campo>
  );
}

// ============================================================ Inteiro

export function CampoInteiro({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  sufixo,
  largura = "curto",
}: BaseProps & { valorInicial?: number | string | null; sufixo?: string }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial) : "");
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura={largura}>
      <div className={`entrada${sufixo ? " com-sufixo" : ""}`}>
        <input
          id={ids.id}
          data-campo={nome}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="valor-num"
          value={valor}
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda, erro, ids)}
          onChange={(e) => {
            setValor(e.target.value.replace(/[^\d.]/g, ""));
            if (erroLocal) setErroLocal(null);
          }}
          onBlur={() => {
            if (valor && parseInteiro(valor) === null) setErroLocal("Digite um número inteiro.");
          }}
        />
        {sufixo && (
          <span className="sufixo" aria-hidden>
            {sufixo}
          </span>
        )}
      </div>
      <input type="hidden" name={nome} value={parseInteiro(valor) ?? valor} />
    </Campo>
  );
}

// ============================================================ Data

const MESES_CURTOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function hojeIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function CampoData({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  mostrarRelativo = true,
  className,
  form,
  aoMudar,
}: Omit<BaseProps, "largura"> & { valorInicial?: string | null; mostrarRelativo?: boolean; form?: string; aoMudar?: (iso: string | null) => void }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const [texto, setTexto] = useState(isoParaBr(valorInicial));
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const iso = parseData(texto);
  const erro = erroLocal ?? erroProp ?? erroServidor ?? null;
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const rel = iso && mostrarRelativo ? relativo(diasEntre(iso, hojeIso())) : null;
  return (
    <Campo
      {...ids}
      rotulo={rotulo}
      ajuda={ajuda ?? "dd/mm/aaaa"}
      opcional={opcional}
      erro={erro}
      largura="data"
      className={className}
      extra={rel && !erro ? <span className="relativo">{`${isoParaBr(iso)} · ${rel}`}</span> : null}
    >
      <div className="entrada com-botao" ref={caixa}>
        <input
          id={ids.id}
          data-campo={nome}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          autoComplete="off"
          value={texto}
          className="tnum"
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda ?? "dd/mm/aaaa", erro, ids)}
          onChange={(e) => {
            const v = /[^\d/]/.test(e.target.value) ? e.target.value : mascaraData(e.target.value);
            setTexto(v);
            if (erroLocal) setErroLocal(null);
            aoMudar?.(parseData(v));
          }}
          onBlur={() => {
            if (!texto) return;
            const p = parseData(texto);
            if (!p) setErroLocal("Data inexistente. Use dd/mm/aaaa, por exemplo 29/11/2026.");
            else setTexto(isoParaBr(p));
          }}
        />
        <button type="button" className="botao-dentro" aria-label="Abrir calendário" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          <CalendarDays size={18} strokeWidth={1.5} />
        </button>
        {aberto && (
          <Calendario
            valor={iso}
            aoEscolher={(d) => {
              setTexto(isoParaBr(d));
              setErroLocal(null);
              setAberto(false);
              aoMudar?.(d);
              document.getElementById(ids.id)?.focus();
            }}
            aoFechar={() => {
              setAberto(false);
              document.getElementById(ids.id)?.focus();
            }}
          />
        )}
      </div>
      <input type="hidden" name={nome} value={iso ?? (texto ? "invalida" : "")} form={form} />
    </Campo>
  );
}

function Calendario({ valor, aoEscolher, aoFechar }: { valor: string | null; aoEscolher: (iso: string) => void; aoFechar: () => void }) {
  const base = valor ?? hojeIso();
  const [mes, setMes] = useState({ ano: +base.slice(0, 4), mes: +base.slice(5, 7) - 1 });
  const [foco, setFoco] = useState(base);
  const grade = useRef<HTMLDivElement>(null);
  const primeiro = new Date(Date.UTC(mes.ano, mes.mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(mes.ano, mes.mes + 1, 0)).getUTCDate();
  const iso = (d: number) => `${mes.ano}-${String(mes.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const hoje = hojeIso();

  useEffect(() => {
    grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [foco, mes]);

  const mover = (delta: number) => {
    const d = new Date(`${foco}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const n = d.toISOString().slice(0, 10);
    setFoco(n);
    setMes({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() });
  };
  const trocarMes = (delta: number) => {
    const d = new Date(Date.UTC(mes.ano, mes.mes + delta, 1));
    setMes({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() });
    setFoco(d.toISOString().slice(0, 10));
  };

  return (
    <div
      className="menu-painel"
      role="dialog"
      aria-label="Escolher data"
      style={{ left: 0, right: "auto", width: 300, padding: 12 }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          aoFechar();
        }
      }}
    >
      <div className="entre" style={{ marginBottom: 8 }}>
        <button type="button" className="btn btn-discreto btn-pequeno btn-icone" aria-label="Mês anterior" onClick={() => trocarMes(-1)}>
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <strong style={{ fontSize: 14 }} aria-live="polite">
          {MESES_CURTOS[mes.mes]} de {mes.ano}
        </strong>
        <button type="button" className="btn btn-discreto btn-pequeno btn-icone" aria-label="Próximo mês" onClick={() => trocarMes(1)}>
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div
        ref={grade}
        role="grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}
        onKeyDown={(e) => {
          const m: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (m[e.key]) {
            e.preventDefault();
            mover(m[e.key]);
          }
          if (e.key === "PageUp") {
            e.preventDefault();
            trocarMes(-1);
          }
          if (e.key === "PageDown") {
            e.preventDefault();
            trocarMes(1);
          }
        }}
      >
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="legenda" role="columnheader" aria-label={NOMES_DIAS[i]} style={{ padding: "4px 0" }}>
            {d}
          </span>
        ))}
        {Array.from({ length: primeiro }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const d = iso(i + 1);
          const sel = d === valor;
          return (
            <button
              key={d}
              type="button"
              data-dia={d}
              tabIndex={d === foco ? 0 : -1}
              aria-pressed={sel}
              aria-label={`${i + 1} de ${MESES_CURTOS[mes.mes]} de ${mes.ano}`}
              onClick={() => aoEscolher(d)}
              style={{
                minHeight: 36,
                border: d === hoje ? "1px solid var(--verde)" : "1px solid transparent",
                borderRadius: 6,
                background: sel ? "var(--verde)" : "transparent",
                color: sel ? "#fff" : "var(--tinta)",
                font: "500 14px/20px var(--fonte)",
                cursor: "pointer",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================ Seleção

export function CampoSelect({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  opcoes,
  valorInicial,
  largura,
  vazio,
  desabilitado,
  aoMudar,
}: BaseProps & { opcoes: { valor: string; rotulo: string }[]; valorInicial?: string | null; vazio?: string; aoMudar?: (v: string) => void }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const erro = erroProp ?? erroServidor ?? null;
  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro} largura={largura}>
      <select
        id={ids.id}
        name={nome}
        data-campo={nome}
        defaultValue={valorInicial ?? ""}
        disabled={desabilitado}
        aria-invalid={!!erro}
        aria-describedby={descricao(ajuda, erro, ids)}
        onChange={(e) => aoMudar?.(e.target.value)}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function SelectUF(props: Omit<BaseProps, "largura"> & { valorInicial?: string | null }) {
  return <CampoSelect {...props} largura="uf" vazio="UF" opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} />;
}

export function SelectMes(props: Omit<BaseProps, "largura"> & { valorInicial?: string | number | null }) {
  return (
    <CampoSelect
      {...props}
      valorInicial={props.valorInicial != null ? String(props.valorInicial) : ""}
      largura="medio"
      vazio="Escolha o mês"
      opcoes={MESES_CURTOS.map((m, i) => ({ valor: String(i + 1), rotulo: m[0].toUpperCase() + m.slice(1) }))}
    />
  );
}

/** Combobox com busca para listas longas (convenções, órgãos). Valor vai num campo escondido. */
export function Combobox({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  opcoes,
  valorInicial,
  vazio = "Nenhuma opção encontrada.",
  semValor,
}: Omit<BaseProps, "largura"> & { opcoes: { valor: string; rotulo: string; detalhe?: string }[]; valorInicial?: string | null; vazio?: string; semValor?: string }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const erro = erroProp ?? erroServidor ?? null;
  const inicial = opcoes.find((o) => o.valor === valorInicial);
  const [valor, setValor] = useState(inicial?.valor ?? "");
  const [texto, setTexto] = useState(inicial?.rotulo ?? "");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaId = `${ids.id}-lista`;
  const caixa = useRef<HTMLDivElement>(null);
  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const sel = opcoes.find((o) => o.valor === valor);
    if (!t || (sel && sel.rotulo === texto)) return opcoes;
    return opcoes.filter((o) => `${o.rotulo} ${o.detalhe ?? ""}`.toLowerCase().includes(t));
  }, [texto, opcoes, valor]);
  const lista = semValor ? [{ valor: "", rotulo: semValor }, ...filtradas] : filtradas;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const escolher = (o: { valor: string; rotulo: string }) => {
    setValor(o.valor);
    setTexto(o.valor ? o.rotulo : "");
    setAberto(false);
  };

  return (
    <Campo {...ids} rotulo={rotulo} ajuda={ajuda} opcional={opcional} erro={erro}>
      <div className="entrada com-botao" ref={caixa} style={{ position: "relative" }}>
        <input
          id={ids.id}
          data-campo={nome}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={aberto && lista[ativo] ? `${listaId}-${ativo}` : undefined}
          aria-invalid={!!erro}
          aria-describedby={descricao(ajuda, erro, ids)}
          autoComplete="off"
          value={texto}
          placeholder="Digite para buscar"
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setValor("");
            setAberto(true);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, lista.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && aberto && lista[ativo]) {
              e.preventDefault();
              escolher(lista[ativo]);
            } else if (e.key === "Escape") {
              setAberto(false);
            }
          }}
        />
        {texto ? (
          <button type="button" className="botao-dentro" aria-label="Limpar" onClick={() => escolher({ valor: "", rotulo: "" })}>
            <X size={16} strokeWidth={1.5} />
          </button>
        ) : null}
        {aberto && (
          <ul id={listaId} role="listbox" className="menu-painel" style={{ left: 0, right: 0, maxHeight: 280, overflow: "auto", margin: 0, listStyle: "none" }}>
            {lista.length === 0 && <li className="legenda" style={{ padding: 10 }}>{vazio}</li>}
            {lista.map((o, i) => (
              <li
                key={o.valor || "nenhum"}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={o.valor === valor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(o);
                }}
                onMouseEnter={() => setAtivo(i)}
                style={{
                  padding: "9px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: i === ativo ? "var(--superficie-2)" : undefined,
                  font: "var(--t-tabela)",
                }}
              >
                <span className="fileira" style={{ gap: 6, flexWrap: "nowrap" }}>
                  {o.valor === valor && o.valor ? <Check size={14} strokeWidth={2} aria-hidden style={{ color: "var(--verde)" }} /> : <span style={{ width: 14 }} />}
                  <span>
                    {o.rotulo}
                    {"detalhe" in o && o.detalhe && <span className="legenda" style={{ display: "block" }}>{o.detalhe}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name={nome} value={valor} />
    </Campo>
  );
}

// ============================================================ Texto longo

export function TextoLongo({
  nome,
  rotulo,
  ajuda,
  opcional,
  erro: erroProp,
  id,
  valorInicial,
  limite,
  linhas = 2,
}: Omit<BaseProps, "largura"> & { valorInicial?: string | null; limite?: number; linhas?: number }) {
  const ids = useIds(nome, id);
  const erroServidor = useErroCampo(nome);
  const erro = erroProp ?? erroServidor ?? null;
  const [valor, setValor] = useState(valorInicial ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [valor]);
  return (
    <Campo
      {...ids}
      rotulo={rotulo}
      ajuda={ajuda}
      opcional={opcional}
      erro={erro}
      extra={limite ? <span className="legenda" style={{ alignSelf: "flex-end" }} aria-live="polite">{`${valor.length} de ${limite}`}</span> : null}
    >
      <textarea
        ref={ref}
        id={ids.id}
        name={nome}
        data-campo={nome}
        rows={linhas}
        value={valor}
        maxLength={limite}
        aria-invalid={!!erro}
        aria-describedby={descricao(ajuda, erro, ids)}
        onChange={(e) => setValor(e.target.value)}
        style={{ minHeight: 0, overflow: "hidden", resize: "none" }}
      />
    </Campo>
  );
}

// ============================================================ Escolhas

export function Interruptor({
  nome,
  rotulo,
  descricao: desc,
  valorInicial,
  desabilitado,
  aoMudar,
}: {
  nome: string;
  rotulo: React.ReactNode;
  descricao?: React.ReactNode;
  valorInicial?: boolean;
  desabilitado?: boolean;
  aoMudar?: (v: boolean) => void;
}) {
  const [ligado, setLigado] = useState(!!valorInicial);
  return (
    <label className="interruptor">
      <input
        type="checkbox"
        role="switch"
        name={nome}
        data-campo={nome}
        checked={ligado}
        disabled={desabilitado}
        aria-checked={ligado}
        onChange={(e) => {
          setLigado(e.target.checked);
          aoMudar?.(e.target.checked);
        }}
      />
      <span className="trilho" aria-hidden />
      <span className="texto">
        <strong>{rotulo}</strong>
        {desc && <span className="ajuda-texto">{desc}</span>}
      </span>
    </label>
  );
}

export function RadiosCartao({
  nome,
  legenda,
  opcoes,
  valorInicial,
  aoMudar,
  desabilitado,
}: {
  nome: string;
  legenda: React.ReactNode;
  opcoes: { valor: string; titulo: React.ReactNode; descricao?: React.ReactNode; extra?: React.ReactNode }[];
  valorInicial?: string;
  aoMudar?: (v: string) => void;
  desabilitado?: boolean;
}) {
  const erro = useErroCampo(nome);
  return (
    <fieldset className="grupo-form" style={{ marginBottom: 16 }}>
      <legend className="rotulo" style={{ font: "500 14px/20px var(--fonte)", marginBottom: 8 }}>
        {legenda}
      </legend>
      <div className="radios-cartao">
        {opcoes.map((o, i) => (
          <label key={o.valor} className="radio-cartao">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              defaultChecked={valorInicial === o.valor}
              disabled={desabilitado}
              data-campo={i === 0 ? nome : undefined}
              onChange={() => aoMudar?.(o.valor)}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{o.titulo}</strong>
              {o.descricao && <span className="desc">{o.descricao}</span>}
              {o.extra}
            </span>
          </label>
        ))}
      </div>
      {erro && (
        <span className="erro-texto" style={{ marginTop: 8 }}>
          <AlertCircle size={16} strokeWidth={1.5} aria-hidden />
          {erro}
        </span>
      )}
    </fieldset>
  );
}

/** Caixa de consentimento: sempre começa desmarcada (P14). */
export function Consentimento({ nome, children }: { nome: string; children: React.ReactNode }) {
  const erro = useErroCampo(nome);
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="check">
        <input type="checkbox" name={nome} data-campo={nome} aria-invalid={!!erro} />
        <span>{children}</span>
      </label>
      {erro && (
        <span className="erro-texto" style={{ marginTop: 6 }}>
          <AlertCircle size={16} strokeWidth={1.5} aria-hidden />
          {erro}
        </span>
      )}
    </div>
  );
}
