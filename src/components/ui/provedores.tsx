"use client";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// =========================================================== Toasts
interface Toast {
  id: number;
  texto: string;
  tipo: "info" | "erro";
  acao?: { rotulo: string; fn: () => void };
}
type MostrarToast = (texto: string, opcoes?: { tipo?: "info" | "erro"; acao?: Toast["acao"]; duracao?: number }) => void;

const CtxToast = createContext<MostrarToast>(() => {});
export const useToast = () => useContext(CtxToast);

// =========================================================== Confirmação
interface PedidoConfirmacao {
  titulo: string;
  texto?: string;
  confirmar?: string;
  perigo?: boolean;
  /** Texto que a pessoa precisa digitar para confirmar (ex.: "EXCLUIR"). */
  digitar?: string;
}
type Confirmar = (p: PedidoConfirmacao) => Promise<boolean>;
const CtxConfirmar = createContext<Confirmar>(async () => true);
export const useConfirmar = () => useContext(CtxConfirmar);

export function Provedores({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const mostrar = useCallback<MostrarToast>((texto, o = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, texto, tipo: o.tipo ?? "info", acao: o.acao }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), o.duracao ?? 5500);
  }, []);

  const [pedido, setPedido] = useState<(PedidoConfirmacao & { resolver: (v: boolean) => void }) | null>(null);
  const [digitado, setDigitado] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);
  const confirmar = useCallback<Confirmar>(
    (p) =>
      new Promise<boolean>((resolver) => {
        setDigitado("");
        setPedido({ ...p, resolver });
      }),
    [],
  );
  useEffect(() => {
    if (pedido && dialogo.current && !dialogo.current.open) dialogo.current.showModal();
  }, [pedido]);
  const fechar = (v: boolean) => {
    pedido?.resolver(v);
    dialogo.current?.close();
    setPedido(null);
  };

  return (
    <CtxToast.Provider value={mostrar}>
      <CtxConfirmar.Provider value={confirmar}>
        {children}
        <Suspense fallback={null}>
          <BarraNavegacao />
        </Suspense>
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.tipo === "erro" ? " erro" : ""}`}>
              <span>{t.texto}</span>
              {t.acao && (
                <button
                  type="button"
                  onClick={() => {
                    t.acao!.fn();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  {t.acao.rotulo}
                </button>
              )}
            </div>
          ))}
        </div>
        <dialog
          ref={dialogo}
          className="janela"
          aria-labelledby="confirmar-titulo"
          onCancel={(e) => {
            e.preventDefault();
            fechar(false);
          }}
        >
          {pedido && (
            <form
              method="dialog"
              onSubmit={(e) => {
                e.preventDefault();
                if (pedido.digitar && digitado.trim() !== pedido.digitar) return;
                fechar(true);
              }}
            >
              <h2 id="confirmar-titulo">{pedido.titulo}</h2>
              {pedido.texto && <p className="secundario">{pedido.texto}</p>}
              {pedido.digitar && (
                <div className="campo mt-16">
                  <label htmlFor="confirmar-digitar">Digite {pedido.digitar} para confirmar</label>
                  <input id="confirmar-digitar" autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
                </div>
              )}
              <div className="janela-acoes">
                <button type="button" className="btn" onClick={() => fechar(false)} autoFocus>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={pedido.perigo ? "btn btn-perigo" : "btn btn-primario"}
                  disabled={!!pedido.digitar && digitado.trim() !== pedido.digitar}
                >
                  {pedido.confirmar ?? "Confirmar"}
                </button>
              </div>
            </form>
          )}
        </dialog>
      </CtxConfirmar.Provider>
    </CtxToast.Provider>
  );
}

/** Barra fina no topo durante a navegação, só se passar de 300 ms. */
function BarraNavegacao() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [largura, setLargura] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const limpar = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const iniciar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      limpar();
      timers.current.push(
        window.setTimeout(() => {
          setVisivel(true);
          setLargura(30);
          timers.current.push(window.setTimeout(() => setLargura(70), 600));
          timers.current.push(window.setTimeout(() => setLargura(85), 2500));
        }, 300),
      );
    };
    document.addEventListener("click", iniciar, true);
    return () => {
      document.removeEventListener("click", iniciar, true);
      limpar();
    };
  }, []);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (!visivel) return;
    const r = window.requestAnimationFrame(() => setLargura(100));
    const t = window.setTimeout(() => {
      setVisivel(false);
      setLargura(0);
    }, 250);
    return () => {
      window.cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params]);

  if (!visivel) return null;
  return <div className="barra-navegacao" style={{ width: `${largura}%` }} role="progressbar" aria-label="Carregando a página" />;
}
