import type { Metadata } from "next";
import Link from "next/link";
import { contexto, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataHora } from "@/lib/format";
import { emailAtivo, whatsappAtivo } from "@/lib/mensagens";
import { SeloSimples } from "@/components/selo";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { rodarAvisosAgora } from "../configuracoes/acoes";

export const metadata: Metadata = { title: "Avisos | Equapar" };

export default async function Avisos() {
  const ctx = await contexto();
  const avisos = await db.aviso.findMany({ where: { contaId: ctx.conta.id }, include: { contrato: true }, orderBy: { enviadoEm: "desc" }, take: 100 });
  return (
    <>
      <div className="app-cab">
        <div>
          <h1>Avisos</h1>
          <p className="secundario mb-0">
            Avisos de prazo aos 60, 30 e 7 dias, de protocolo, de deferimento e o resumo semanal. <Link href="/app/configuracoes?aba=avisos">Escolher canais e horário</Link>
          </p>
        </div>
        {pode(ctx.papel, "gerenciar_conta") && (
          <FormAcao action={rodarAvisosAgora}>
            <BotaoEnvio className="btn" pendente="Verificando…">
              Verificar prazos agora
            </BotaoEnvio>
          </FormAcao>
        )}
      </div>
      {(!emailAtivo() || !whatsappAtivo()) && (
        <p className="aviso-caixa info">
          Modo simulação: {!emailAtivo() && "e-mail"}
          {!emailAtivo() && !whatsappAtivo() && " e "}
          {!whatsappAtivo() && "WhatsApp"} ainda não {!emailAtivo() && !whatsappAtivo() ? "estão configurados" : "está configurado"}. As mensagens abaixo foram montadas e
          registradas, mas não saíram do sistema. Configure as chaves no arquivo .env para enviar de verdade.
        </p>
      )}
      {avisos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum aviso ainda.</p>
        </div>
      ) : (
        <ul className="lista-limpa pilha-8 mt-16">
          {avisos.map((a) => (
            <li key={a.id} className="cartao" style={{ padding: 16 }}>
              <div className="entre">
                <div className="fileira">
                  <strong>{a.assunto ?? a.tipo}</strong>
                  <SeloSimples texto={a.canal === "EMAIL" ? "E-mail" : "WhatsApp"} tom="neutro" icone="check" />
                  <SeloSimples
                    texto={a.status === "SIMULADO" ? "Simulado" : a.status === "ENVIADO" ? "Enviado" : "Erro"}
                    tom={a.status === "ENVIADO" ? "verde" : a.status === "ERRO" ? "carimbo" : "azul"}
                    icone={a.status === "ERRO" ? "alerta" : "check"}
                  />
                </div>
                <span className="legenda">
                  {dataHora(a.enviadoEm)} · para {a.destino}
                </span>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, margin: "10px 0 0" }}>{a.corpo}</pre>
              {a.erro && <p className="erro-texto">{a.erro}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
