import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Download, Mail, MessageCircle } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { data, dataHora, diasAte, emDias, plural } from "@/lib/format";
import { emailAtivo, whatsappAtivo } from "@/lib/mensagens";
import type { Classificado } from "@/lib/central-avisos";
import { classificarAvisos, ehPendente, LIMITE_AVISOS } from "./eventos";
import { SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { Alerta, CabecalhoPagina } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { rodarAvisosAgora } from "../configuracoes/acoes";

export const metadata: Metadata = { title: "Avisos | Equapar" };

function quando(d: Date) {
  const dias = diasAte(d);
  if (dias === 0) return `hoje, ${dataHora(d).split(" ")[1]}`;
  return emDias(dias);
}

const VISOES = [
  ["acao", "Precisa de você"],
  ["prazos", "Prazos"],
  ["historico", "Histórico de envios"],
] as const;
type Visao = (typeof VISOES)[number][0];

const PRIORIDADE: Record<Classificado["prioridade"], { texto: string; tom: "carimbo" | "ambar" | "neutro"; icone: "alerta" | "relogio" | "check" }> = {
  ALTA: { texto: "Urgente", tom: "carimbo", icone: "alerta" },
  MEDIA: { texto: "Em breve", tom: "ambar", icone: "relogio" },
  BAIXA: { texto: "Sem urgência", tom: "neutro", icone: "check" },
};
const STATUS_ENVIO: Record<string, string> = { SIMULADO: "simulado", ENVIADO: "enviado", ERRO: "falhou" };

export default async function Avisos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const ctx = await contexto();
  const { ver } = await searchParams;
  const visao: Visao = VISOES.some(([k]) => k === ver) ? (ver as Visao) : "acao";
  const [linhas, trabalhos] = await Promise.all([
    db.aviso.findMany({ where: { contaId: ctx.conta.id }, orderBy: { enviadoEm: "desc" }, take: LIMITE_AVISOS }),
    db.trabalhoFundo.findMany({ where: { usuarioId: ctx.usuario.id }, orderBy: { criadoEm: "desc" }, take: 5 }),
  ]);
  // Ao abrir, as tarefas prontas contam como vistas (o ponto do sino some)
  await db.trabalhoFundo.updateMany({ where: { usuarioId: ctx.usuario.id, status: { in: ["PRONTO", "ERRO"] }, vistoEm: null }, data: { vistoEm: new Date() } });

  const { eventos, itens } = await classificarAvisos(ctx, linhas);
  const pendentes = itens.filter(ehPendente);
  const prazos = itens.filter((x) => x.c.categoria === "PRAZO");
  // ocorrências já resolvidas ou informativas idênticas (ex.: vários pagamentos em dia) viram uma linha com a contagem
  const agrupados: (typeof itens[number] & { iguais: number })[] = [];
  for (const x of visao === "acao" ? pendentes : visao === "prazos" ? prazos : itens) {
    const igual = x.c.situacao !== "PENDENTE" ? agrupados.find((y) => y.ev.tipo === x.ev.tipo && y.c.situacao === x.c.situacao && y.c.titulo === x.c.titulo && y.c.resumo === x.c.resumo && y.c.acao?.href === x.c.acao?.href) : undefined;
    if (igual) igual.iguais++;
    else agrupados.push({ ...x, iguais: 0 });
  }
  const lista = agrupados;
  const semCanal = [!emailAtivo() && "e-mail", !whatsappAtivo() && "WhatsApp"].filter(Boolean) as string[];
  const contagem: Record<Visao, number> = { acao: pendentes.length, prazos: prazos.filter((x) => x.c.situacao === "PENDENTE").length, historico: eventos.length };

  return (
    <>
      <CabecalhoPagina
        titulo="Avisos"
        subtitulo={
          <>
            O que mudou na sua carteira e o que fazer em seguida. <Link href="/app/configuracoes?aba=avisos">Escolher canais e horário</Link>
          </>
        }
        acao={
          pode(ctx.papel, "gerenciar_conta") ? (
            <FormAcao action={rodarAvisosAgora}>
              <BotaoEnvio className="btn" pendente="Verificando os prazos…">
                Verificar prazos agora
              </BotaoEnvio>
            </FormAcao>
          ) : undefined
        }
      />

      {trabalhos.length > 0 && (
        <section className="pilha-8 mb-16" aria-label="Tarefas em segundo plano">
          {trabalhos.map((t) =>
            t.status === "RODANDO" ? (
              <Alerta key={t.id} tipo="info" titulo="Exportação em andamento">
                Começou {quando(t.criadoEm)}. Avisamos aqui e no sino quando terminar.
              </Alerta>
            ) : t.status === "PRONTO" ? (
              <Alerta
                key={t.id}
                tipo="sucesso"
                titulo="Exportação pronta"
                acao={
                  <a href={`/api/trabalhos/${t.id}`} className="btn btn-pequeno" download>
                    <Download size={14} strokeWidth={1.5} aria-hidden /> Baixar
                  </a>
                }
              >
                Concluída {t.concluidoEm ? quando(t.concluidoEm) : ""}. O arquivo fica disponível por 7 dias.
              </Alerta>
            ) : (
              <Alerta
                key={t.id}
                tipo="erro"
                titulo="A exportação não terminou"
                acao={
                  <Link href="/app/configuracoes?aba=dados" className="btn btn-pequeno">
                    Tentar de novo
                  </Link>
                }
              >
                {t.erro ?? "Algo falhou ao montar o arquivo."}
              </Alerta>
            ),
          )}
        </section>
      )}

      <nav className="abas" aria-label="Filtrar avisos">
        {VISOES.map(([k, n]) => (
          <Link key={k} href={`/app/avisos${k === "acao" ? "" : `?ver=${k}`}`} aria-current={visao === k ? "page" : undefined} scroll={false}>
            {n}
            {contagem[k] > 0 && k !== "historico" ? <span className="contador-alerta">{contagem[k]}</span> : null}
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <EstadoVazio
          icone={Bell}
          titulo={visao === "acao" ? "Nada pendente agora" : visao === "prazos" ? "Nenhum aviso de prazo" : "Nenhum aviso ainda"}
          porque={
            visao === "acao"
              ? "Quando um prazo se aproximar ou um pedido precisar do próximo passo, ele aparece aqui com o atalho para resolver."
              : "Os avisos aparecem quando um prazo se aproxima ou um pedido muda de situação."
          }
        />
      ) : (
        <ul className="lista-limpa pilha-8" aria-label={VISOES.find(([k]) => k === visao)?.[1]}>
          {lista.map(({ ev, c, iguais }) => {
            // o título já começa com "Contrato N": a linha de cima mostra só o órgão
            const partes = c.objeto?.split(" · ") ?? [];
            const objeto = partes.length > 1 && c.titulo.startsWith(partes[0]) ? partes.slice(1).join(" · ") : c.objeto;
            return (
            <li key={ev.chave} className={`cartao aviso-item${c.situacao === "RESOLVIDO" ? " aviso-resolvido" : ""}`}>
              <div className="aviso-corpo">
                <div className="fileira" style={{ flexWrap: "wrap", gap: 8 }}>
                  {c.situacao === "PENDENTE" ? (
                    <SeloSimples texto={PRIORIDADE[c.prioridade].texto} tom={PRIORIDADE[c.prioridade].tom} icone={PRIORIDADE[c.prioridade].icone} />
                  ) : (
                    c.situacao === "RESOLVIDO" ? <SeloSimples texto="Resolvido" tom="verde" icone="check" /> : <SeloSimples texto="Informativo" tom="azul" icone="ampulheta" />
                  )}
                  {objeto && <span className="legenda aviso-objeto">{objeto}</span>}
                </div>
                <h2 className="aviso-titulo">{c.titulo}</h2>
                <p className="secundario mb-0">{c.resumo}</p>
                {visao === "historico" && ev.envios[0]?.assunto && <p className="legenda mt-8 mb-0">Mensagem: {ev.envios[0].assunto}</p>}
                <p className="aviso-meta mt-8 mb-0">
                  Avisado{" "}
                  <time dateTime={ev.ultimoEnvio.toISOString()} title={dataHora(ev.ultimoEnvio)}>
                    {quando(ev.ultimoEnvio)}
                  </time>
                  {c.prazo ? ` · prazo ${data(c.prazo)}` : ""} · {plural(ev.envios.length, "envio", "envios")}
                  {iguais > 0 ? ` · e mais ${plural(iguais, "aviso igual anterior", "avisos iguais anteriores")}` : ""}
                </p>
                {visao === "historico" && (
                  <details className="mt-8">
                    <summary className="legenda">Ver as mensagens enviadas</summary>
                    <ul className="lista-limpa pilha-8 mt-8">
                      {ev.envios.map((e) => (
                        <li key={e.id} className="aviso-envio">
                          <p className="legenda mb-0 fileira" style={{ gap: 6 }}>
                            {e.canal === "EMAIL" ? <Mail size={14} strokeWidth={1.5} aria-hidden /> : <MessageCircle size={14} strokeWidth={1.5} aria-hidden />}
                            {e.canal === "EMAIL" ? "E-mail" : "WhatsApp"} para {e.destino} · {STATUS_ENVIO[e.status] ?? e.status} · {dataHora(e.enviadoEm)}
                          </p>
                          <pre className="aviso-texto">{e.corpo}</pre>
                          {e.erro && <p className="erro-texto mb-0">{e.erro}</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              {c.acao && (
                <Link href={c.acao.href} className={c.situacao === "PENDENTE" ? "btn btn-primario aviso-acao" : "btn aviso-acao"}>
                  {c.acao.rotulo} <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
                </Link>
              )}
            </li>
            );
          })}
        </ul>
      )}

      {semCanal.length > 0 && (
        <p className="legenda mt-24">
          Modo simulação: {semCanal.join(" e ")} {semCanal.length > 1 ? "ainda não estão configurados" : "ainda não está configurado"}; as mensagens foram registradas, mas não saíram do sistema.
        </p>
      )}
    </>
  );
}
