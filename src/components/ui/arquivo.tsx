"use client";
import { useRef, useState } from "react";
import { CheckCircle2, FileText, Upload, X } from "lucide-react";
import { useFormulario } from "../form-acao";

const TIPOS: Record<string, { ext: string[]; nome: string }> = {
  pdf: { ext: [".pdf"], nome: "PDF" },
  excel: { ext: [".xlsx"], nome: "Excel" },
  word: { ext: [".docx"], nome: "Word" },
  imagem: { ext: [".png", ".jpg", ".jpeg"], nome: "imagem" },
};

function tamanho(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Área de arrastar e soltar (5.1). Mostra nome, tamanho, barra enquanto envia, ✓ e remover.
 * Valida tipo e tamanho no navegador; o servidor valida de novo.
 * `enviarAoEscolher`: envia o formulário assim que o arquivo é escolhido.
 */
export function AreaArquivo({
  nome = "arquivo",
  rotulo,
  tipos = ["pdf", "excel", "word", "imagem"],
  limiteMb = 15,
  enviarAoEscolher,
  compacta,
  enviado,
  id,
}: {
  nome?: string;
  rotulo?: string;
  tipos?: (keyof typeof TIPOS)[];
  limiteMb?: number;
  enviarAoEscolher?: boolean;
  compacta?: boolean;
  enviado?: boolean;
  id?: string;
}) {
  const { pendente } = useFormulario();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const extensoes = tipos.flatMap((t) => TIPOS[t].ext);
  const descricaoTipos = `${tipos.map((t) => TIPOS[t].nome).join(", ").replace(/, ([^,]*)$/, " ou $1")}, até ${limiteMb} MB`;

  const aceitar = (f: File | undefined, lista?: FileList) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!extensoes.includes(ext)) {
      setErro(`Esse tipo de arquivo não é aceito aqui. Envie ${descricaoTipos.split(",").slice(0, -1).join(",") || descricaoTipos}.`);
      if (input.current) input.current.value = "";
      return;
    }
    if (f.size > limiteMb * 1024 * 1024) {
      setErro(`O arquivo tem ${tamanho(f.size)}. O limite é ${limiteMb} MB.`);
      if (input.current) input.current.value = "";
      return;
    }
    setErro(null);
    setArquivo(f);
    if (lista && input.current) input.current.files = lista;
    if (enviarAoEscolher) window.setTimeout(() => input.current?.form?.requestSubmit(), 0);
  };

  return (
    <div>
      <label
        className={`zona-arquivo${compacta ? " compacta" : ""}${arrastando ? " arrastando" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          aceitar(e.dataTransfer.files[0], e.dataTransfer.files);
        }}
      >
        <Upload size={compacta ? 20 : 28} strokeWidth={1.5} aria-hidden style={{ color: "var(--verde)", flexShrink: 0 }} />
        <span style={{ display: "block" }}>
          <span style={{ display: "block", fontWeight: 500, margin: compacta ? 0 : "8px 0 2px" }}>
            {rotulo ?? (
              <>
                Arraste o arquivo aqui ou <span style={{ color: "var(--verde)", textDecoration: "underline" }}>escolha no computador</span>
              </>
            )}
          </span>
          <span className="tipos">{descricaoTipos}</span>
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          name={nome}
          accept={extensoes.join(",")}
          className="sr-only"
          onChange={(e) => aceitar(e.target.files?.[0])}
        />
      </label>
      {erro && (
        <p className="erro-texto" role="alert" style={{ marginTop: 8 }}>
          {erro}
        </p>
      )}
      {arquivo && (
        <ul className="lista-arquivos" aria-live="polite">
          <li>
            <FileText size={18} strokeWidth={1.5} aria-hidden style={{ color: "var(--grafite)" }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {arquivo.name} <span className="legenda">· {tamanho(arquivo.size)}</span>
            </span>
            {pendente ? (
              <span className="legenda">Enviando…</span>
            ) : enviado ? (
              <CheckCircle2 size={18} strokeWidth={1.5} aria-label="Enviado" style={{ color: "var(--verde)" }} />
            ) : (
              <button
                type="button"
                className="btn btn-discreto btn-pequeno btn-icone"
                aria-label={`Remover ${arquivo.name}`}
                onClick={() => {
                  setArquivo(null);
                  if (input.current) input.current.value = "";
                }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
            {pendente && (
              <span className="barra indeterminada" role="progressbar" aria-label="Enviando o arquivo">
                <span />
              </span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
