import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Scale, Settings, Users } from "lucide-react";
import { contexto, ehDemo } from "@/lib/auth";
import { CabecalhoPagina } from "@/components/ui/estrutura";

export const metadata: Metadata = { title: "Mais | Equapar" };

/** 5.2: no celular, o quinto item da barra inferior leva aqui. */
export default async function Mais() {
  const ctx = await contexto();
  const itens = [
    { href: "/app/convencoes", nome: "Convenções", detalhe: "Convenções coletivas e datas-base", icone: Scale },
    { href: "/app/avisos", nome: "Avisos", detalhe: "Prazos, respostas e trabalhos prontos", icone: Bell },
    { href: "/app/configuracoes", nome: "Configurações", detalhe: "Conta, equipe, avisos e cobrança", icone: Settings },
    ...(ctx.conta.tipo === "ASSESSORIA" ? [{ href: "/app/clientes", nome: "Clientes", detalhe: "Empresas atendidas pela assessoria", icone: Users }] : []),
    ...(!ehDemo(ctx) ? [{ href: "/app/trocar-conta", nome: "Trocar de conta", detalhe: "Outras contas em que você participa", icone: Users }] : []),
  ];
  return (
    <>
      <CabecalhoPagina titulo="Mais" />
      <ul className="lista-limpa cartao lista-mais">
        {itens.map(({ href, nome, detalhe, icone: Icone }) => (
          <li key={href}>
            <Link href={href} className="entre item-mais">
              <span className="fileira">
                <Icone size={20} strokeWidth={1.5} aria-hidden />
                <span>
                  <strong style={{ fontWeight: 500, display: "block" }}>{nome}</strong>
                  <span className="legenda">{detalhe}</span>
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
