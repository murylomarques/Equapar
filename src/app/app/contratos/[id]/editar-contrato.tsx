"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { PainelLateral } from "@/components/ui/estrutura";
import { FormContrato, type ContratoForm } from "../form-contrato";
import { editarContrato } from "../../acoes";

/** "Editar dados" abre o formulário num painel lateral (tela cheia no celular). */
export function EditarContrato({
  contrato,
  convencoes,
  empresas,
}: {
  contrato: ContratoForm;
  convencoes: { id: string; nome: string; detalhe: string }[];
  empresas: { id: string; razaoSocial: string }[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [aberto, setAberto] = useState(params.get("editar") === "1");
  const fechar = () => {
    setAberto(false);
    if (params.get("editar")) router.replace(`/app/contratos/${contrato.id}`, { scroll: false });
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => setAberto(true)}>
        <Pencil size={16} strokeWidth={1.5} aria-hidden /> Editar dados
      </button>
      <PainelLateral aberto={aberto} aoFechar={fechar} titulo={`Editar contrato ${contrato.numero}`}>
        {aberto && (
          <FormContrato
            action={editarContrato}
            contrato={contrato}
            convencoes={convencoes}
            empresas={empresas}
            aoCancelar={fechar}
            aoConcluir={(r) => {
              if (r.ok) fechar();
            }}
          />
        )}
      </PainelLateral>
    </>
  );
}
