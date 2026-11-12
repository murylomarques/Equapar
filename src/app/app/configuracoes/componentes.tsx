"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { useToast } from "@/components/ui/provedores";
import { Carregando } from "@/components/ui/espera";

/** Enquanto a exportação roda, atualiza a tela a cada 3 s e avisa por toast quando terminar. */
export function AcompanharExportacao({ status, id }: { status: "RODANDO" | "PRONTO" | "ERRO" | null; id: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const anterior = useRef(status);
  useEffect(() => {
    if (anterior.current === "RODANDO" && status === "PRONTO") toast("Exportação pronta. O arquivo está disponível para baixar.");
    if (anterior.current === "RODANDO" && status === "ERRO") toast("A exportação não terminou. Tente de novo.", { tipo: "erro" });
    anterior.current = status;
    if (status !== "RODANDO") return;
    const t = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(t);
  }, [status, router, toast]);
  if (status === "RODANDO") return <Carregando texto="Montando o arquivo em segundo plano. Você pode continuar usando o sistema." />;
  if (status === "PRONTO" && id)
    return (
      <a href={`/api/trabalhos/${id}`} className="btn" download>
        <Download size={16} strokeWidth={1.5} aria-hidden /> Baixar a última exportação
      </a>
    );
  return null;
}
