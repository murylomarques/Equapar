import { Bell, CalendarClock, DollarSign, FileText, FolderOpen, LayoutList, Scale, Search, Users } from "lucide-react";
import Link from "next/link";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { LinkNav } from "./link-nav";
import { SeletorEmpresa } from "./seletor-empresa";
import { sair } from "../(auth)/acoes";
import { EMAIL_DEMO } from "@/lib/site";
import { diasAtras } from "@/lib/format";
import "./app.css";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  const assessoria = ctx.conta.tipo === "ASSESSORIA";
  const naoLidos = await db.aviso.count({ where: { contaId: ctx.conta.id, enviadoEm: { gte: diasAtras(7) } } });
  const demo = ctx.usuario.email === EMAIL_DEMO;
  return (
    <div className="app">
      <aside className="app-lateral" aria-label="Navegação do produto">
        <div style={{ padding: "0 12px" }}>
          <Logo href="/app/hoje" largura={112} />
        </div>
        <nav>
          <LinkNav href="/app/hoje" icone={<CalendarClock size={20} strokeWidth={1.5} />}>
            Hoje
          </LinkNav>
          <LinkNav href="/app/carteira" icone={<LayoutList size={20} strokeWidth={1.5} />}>
            Carteira
          </LinkNav>
          <LinkNav href="/app/pedidos" icone={<FileText size={20} strokeWidth={1.5} />}>
            Pedidos
          </LinkNav>
          <LinkNav href="/app/a-receber" icone={<DollarSign size={20} strokeWidth={1.5} />}>
            A receber
          </LinkNav>
          <LinkNav href="/app/convencoes" icone={<Scale size={20} strokeWidth={1.5} />}>
            Convenções
          </LinkNav>
          {assessoria && (
            <LinkNav href="/app/clientes" icone={<Users size={20} strokeWidth={1.5} />}>
              Clientes
            </LinkNav>
          )}
        </nav>
        <div className="rodape-lateral">
          {ctx.conta.nome}
          <br />
          Plano {({ GRATIS: "grátis", PILOTO: "piloto", CARTEIRA: "carteira", ASSESSORIA: "assessoria" } as const)[ctx.conta.plano]}
        </div>
      </aside>

      <div className="app-principal">
        {demo && <div className="faixa-demo">Demonstração com dados fictícios, só para leitura. Nada aqui é de uma empresa real.</div>}
        <header className="app-topo">
          <span className="so-celular">
            <Logo href="/app/hoje" largura={96} />
          </span>
          <form action="/app/busca" className="app-busca so-desktop" role="search">
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <label htmlFor="busca" className="sr-only">
              Buscar contrato
            </label>
            <input id="busca" name="q" type="search" placeholder="Número do contrato, órgão ou objeto" />
          </form>
          <div className="fileira" style={{ marginLeft: "auto" }}>
            {assessoria && <SeletorEmpresa empresas={ctx.empresas.map((e) => ({ id: e.id, nome: e.razaoSocial }))} atual={ctx.empresaId} />}
            <Link href="/app/busca" className="icone-botao so-celular" aria-label="Buscar">
              <Search size={20} strokeWidth={1.5} />
            </Link>
            <Link href="/app/avisos" className="icone-botao" aria-label={`Avisos${naoLidos ? `: ${naoLidos} nos últimos 7 dias` : ""}`}>
              <Bell size={20} strokeWidth={1.5} />
              {naoLidos > 0 && <span className="ponto" aria-hidden />}
            </Link>
            <details className="menu">
              <summary className="btn btn-pequeno" aria-label="Conta">
                {ctx.usuario.nome.split(" ")[0]}
              </summary>
              <div className="menu-painel">
                <div className="legenda" style={{ padding: "6px 10px" }}>
                  {ctx.usuario.email}
                </div>
                <Link href="/app/configuracoes">Configurações</Link>
                <Link href="/app/configuracoes?aba=avisos">Avisos</Link>
                <Link href="/app/pedidos">
                  <FolderOpen size={16} strokeWidth={1.5} /> Todos os pedidos
                </Link>
                <form action={sair}>
                  <button type="submit">Sair</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main id="conteudo" className="app-conteudo">
          {children}
        </main>
      </div>

      <nav className="app-inferior" aria-label="Navegação no celular">
        <LinkNav href="/app/hoje" icone={<CalendarClock size={22} strokeWidth={1.5} />}>
          Hoje
        </LinkNav>
        <LinkNav href="/app/carteira" icone={<LayoutList size={22} strokeWidth={1.5} />}>
          Carteira
        </LinkNav>
        <LinkNav href="/app/a-receber" icone={<DollarSign size={22} strokeWidth={1.5} />}>
          A receber
        </LinkNav>
        <LinkNav href="/app/avisos" icone={<Bell size={22} strokeWidth={1.5} />}>
          Avisos
        </LinkNav>
      </nav>
    </div>
  );
}
