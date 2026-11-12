import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Download, Mail, MessageCircle } from "lucide-react";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataHora, diasAte, emDias, plural } from "@/lib/format";
import { emailAtivo, whatsappAtivo } from "@/lib/mensagens";
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

export default async function Avisos() {
  const ctx = await contexto();
  const [avisos, trabalhos] = await Promise.all([
    db.aviso.findMany({ where: { contaId: ctx.conta.id }, include: { contrato: true }, orderBy: { enviadoEm: "desc" }, take: 100 }),
    db.trabalhoFundo.findMany({ where: { usuarioId: ctx.usuario.id }, orderBy: { criadoEm: "desc" }, take: 5 }),
  ]);
  // Ao abrir, as tarefas prontas contam como vistas (o ponto do sino some)
  await db.trabalhoFundo.updateMany({ where: { usuarioId: ctx.usuario.id, status: { in: ["PRONTO", "ERRO"] }, vistoEm: null }, data: { vistoEm: new Date() } });
  const semCanal = [!emailAtivo() && "e-mail", !whatsappAtivo() && "WhatsApp"].filter(Boolean) as string[];

  return (
    <>
      <CabecalhoPagina
        titulo="Avisos"
        subtitulo={
          <>
            Prazos aos 60, 30 e 7 dias, protocolo, deferimento e o resumo semanal. <Link href="/app/configuracoes?aba=avisos">Escolher canais e horário</Link>
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
              <Alerta key={t.id} tipo="erro" titulo="A exportação não terminou">
                {t.erro ?? "Tente de novo em Configurações › Dados."}
              </Alerta>
            ),
          )}
        </section>
      )}

      {semCanal.length > 0 && (
        <Alerta tipo="info" titulo="Modo simulação" className="mb-16">
          {semCanal.join(" e ")} {semCanal.length > 1 ? "ainda não estão configurados" : "ainda não está configurado"}. As mensagens abaixo foram montadas e registradas, mas não saíram do sistema.
        </Alerta>
      )}

      {avisos.length === 0 ? (
        <EstadoVazio icone={Bell} titulo="Nenhum aviso ainda" porque="Os avisos aparecem aqui quando um prazo se aproxima ou um pedido muda de situação." />
      ) : (
        <>
          <p className="legenda">{plural(avisos.length, "aviso", "avisos")} (os 100 mais recentes)</p>
          <ul className="lista-limpa pilha-8">
            {avisos.map((a) => (
              <li key={a.id} className="cartao" style={{ padding: 16 }}>
                <div className="entre" style={{ alignItems: "flex-start" }}>
                  <div className="fileira" style={{ minWidth: 0 }}>
                    {a.canal === "EMAIL" ? (
                      <Mail size={18} strokeWidth={1.5} aria-label="E-mail" />
                    ) : (
                      <MessageCircle size={18} strokeWidth={1.5} aria-label="WhatsApp" />
                    )}
                    <strong>{a.assunto ?? (a.canal === "WHATSAPP" ? "Mensagem de WhatsApp" : a.tipo)}</strong>
                  </div>
                  <div className="fileira">
                    <SeloSimples texto={a.canal === "EMAIL" ? "E-mail" : "WhatsApp"} tom="neutro" icone="check" />
                    <SeloSimples
                      texto={a.status === "SIMULADO" ? "Simulado" : a.status === "ENVIADO" ? "Enviado" : "Falhou"}
                      tom={a.status === "ENVIADO" ? "verde" : a.status === "ERRO" ? "carimbo" : "azul"}
                      icone={a.status === "ERRO" ? "alerta" : "check"}
                    />
                  </div>
                </div>
                <p className="legenda mt-8 mb-0">
                  <time dateTime={a.enviadoEm.toISOString()} title={dataHora(a.enviadoEm)}>
                    {quando(a.enviadoEm)}
                  </time>{" "}
                  · para {a.destino}
                  {a.contrato ? ` · contrato ${a.contrato.numero}` : ""}
                </p>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, margin: "10px 0 0" }}>{a.corpo}</pre>
                {a.erro && <p className="erro-texto">{a.erro}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
