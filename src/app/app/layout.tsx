import { Bell, CalendarClock, DollarSign, FileText, LayoutList, Scale, Search, Settings, Users, LogOut } from "lucide-react";
import Link from "next/link";
import { contexto, ehDemo, escopoContratos } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { MenuSuspenso } from "@/components/ui/estrutura";
import { LinkNav } from "./link-nav";
import { SeletorEmpresa } from "./seletor-empresa";
import { AtalhoBusca } from "./atalho-busca";
import { sair } from "../(auth)/acoes";
import { diasAtras } from "@/lib/format";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { reenviarConfirmacao } from "./acoes";
import "./app.css";

export const dynamic = "force-dynamic";

const NOME_PLANO = { GRATIS: "grátis", PILOTO: "piloto", CARTEIRA: "carteira", ASSESSORIA: "assessoria" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  const assessoria = ctx.conta.tipo === "ASSESSORIA";
  const [avisosRecentes, trabalhosProntos, pedidosAbertos, aReceber] = await Promise.all([
    db.aviso.count({ where: { contaId: ctx.conta.id, enviadoEm: { gte: diasAtras(7) } } }),
    db.trabalhoFundo.count({ where: { usuarioId: ctx.usuario.id, status: { in: ["PRONTO", "ERRO"] }, vistoEm: null } }),
    db.pedido.count({ where: { contrato: escopoContratos(ctx), estado: { in: ["EM_ANALISE", "CALCULO_VALIDADO"] } } }),
    db.pedido.count({ where: { contrato: escopoContratos(ctx), estado: { in: ["DEFERIDO", "FATURADO"] } } }),
  ]);
  const sino = avisosRecentes + trabalhosProntos;
  const demo = ehDemo(ctx);
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
          <LinkNav href="/app/pedidos" icone={<FileText size={20} strokeWidth={1.5} />} contador={pedidosAbertos} rotuloContador="pedidos em andamento">
            Pedidos
          </LinkNav>
          <LinkNav href="/app/a-receber" icone={<DollarSign size={20} strokeWidth={1.5} />} contador={aReceber} rotuloContador="valores a receber">
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
          Plano {NOME_PLANO[ctx.conta.plano]}
        </div>
      </aside>

      <div className="app-principal">
        {demo && (
          <div className="faixa-demo">
            {ctx.conta.demo
              ? "Demonstração com dados fictícios: experimente à vontade. Nada é enviado por e-mail ou WhatsApp, e esta cópia some em 4 horas. "
              : "Demonstração com dados fictícios, só para leitura. Nada aqui é de uma empresa real. "}
            <Link href="/criar-conta">Crie sua conta para usar</Link>.
          </div>
        )}
        {!demo && !ctx.usuario.emailVerificadoEm && (
          <div className="faixa-demo faixa-confirmar">
            <span>
              Confirme seu e-mail (<strong>{ctx.usuario.email}</strong>) para receber os avisos de prazo. O link está na sua caixa de entrada.
            </span>
            <FormAcao action={reenviarConfirmacao} className="fileira" semToast={false}>
              <BotaoEnvio className="btn btn-pequeno">Reenviar o link</BotaoEnvio>
            </FormAcao>
          </div>
        )}
        <header className="app-topo">
          <span className="so-celular">
            <Logo href="/app/hoje" largura={96} />
          </span>
          <form action="/app/busca" className="app-busca so-desktop" role="search">
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <label htmlFor="busca" className="sr-only">
              Buscar contrato
            </label>
            <input id="busca" name="q" type="search" placeholder="Buscar contrato, órgão ou objeto" aria-keyshortcuts="/" />
            <kbd className="atalho-tecla" aria-hidden>
              /
            </kbd>
          </form>
          <AtalhoBusca />
          <div className="fileira" style={{ marginLeft: "auto" }}>
            {assessoria && <SeletorEmpresa empresas={ctx.empresas.map((e) => ({ id: e.id, nome: e.razaoSocial }))} atual={ctx.empresaId} />}
            <Link href="/app/busca" className="icone-botao so-celular" aria-label="Buscar">
              <Search size={20} strokeWidth={1.5} />
            </Link>
            <Link href="/app/avisos" className="icone-botao" aria-label={sino ? `Avisos: ${sino} novos` : "Avisos"}>
              <Bell size={20} strokeWidth={1.5} />
              {sino > 0 && <span className="ponto" aria-hidden />}
            </Link>
            <MenuSuspenso rotulo={`Conta de ${ctx.usuario.nome.split(" ")[0]}`} className="btn btn-pequeno" conteudoBotao={ctx.usuario.nome.split(" ")[0]}>
              <div className="cab-menu">
                <strong style={{ display: "block", color: "var(--tinta)", fontSize: 14 }}>{ctx.usuario.nome}</strong>
                {ctx.usuario.email}
              </div>
              <hr />
              <Link href="/app/configuracoes" role="menuitem">
                <Settings size={16} strokeWidth={1.5} aria-hidden /> Configurações
              </Link>
              <Link href="/app/avisos" role="menuitem">
                <Bell size={16} strokeWidth={1.5} aria-hidden /> Avisos
              </Link>
              <hr />
              <form action={sair}>
                <button type="submit" role="menuitem">
                  <LogOut size={16} strokeWidth={1.5} aria-hidden /> Sair
                </button>
              </form>
            </MenuSuspenso>
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
