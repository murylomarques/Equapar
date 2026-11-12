import type { Metadata } from "next";
import Link from "next/link";
import { contexto, NOME_PAPEL, pode } from "@/lib/auth";
import { db } from "@/lib/db";
import { prefsDe } from "@/lib/avisos";
import { dataHora, reais } from "@/lib/format";
import { emailAtivo, whatsappAtivo } from "@/lib/mensagens";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { SeloSimples } from "@/components/selo";
import { DoisFatores } from "./dois-fatores";
import {
  convidarPessoa,
  encerrarOutraSessao,
  excluirConta,
  mudarPapel,
  mudarPlano,
  removerPessoa,
  salvarAvisos,
  salvarConta,
  trocarSenha,
} from "./acoes";

export const metadata: Metadata = { title: "Configurações | Equapar" };

const ABAS = [
  ["empresa", "Empresa"],
  ["pessoas", "Pessoas e papéis"],
  ["avisos", "Avisos"],
  ["cobranca", "Cobrança"],
  ["seguranca", "Segurança"],
  ["dados", "Dados"],
] as const;

const PLANOS = [
  { id: "GRATIS", nome: "Raio-X (grátis)", desc: "Carteira e prazos. Montar pedidos faz parte do piloto ou da assinatura." },
  { id: "PILOTO", nome: "Piloto", desc: "A partir de R$ 1.500 por pedido." },
  { id: "CARTEIRA", nome: "Carteira", desc: "R$ 4 por posto por mês, mínimo R$ 297." },
  { id: "ASSESSORIA", nome: "Assessoria", desc: "A partir de R$ 1.497 por mês." },
] as const;

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await contexto();
  const { aba = "empresa" } = await searchParams;
  const dono = pode(ctx.papel, "gerenciar_conta");
  return (
    <>
      <h1>Configurações</h1>
      <nav className="abas mt-16" aria-label="Seções">
        {ABAS.map(([k, n]) => (
          <Link key={k} href={`/app/configuracoes?aba=${k}`} aria-current={aba === k ? "page" : undefined}>
            {n}
          </Link>
        ))}
      </nav>
      <div style={{ maxWidth: 820 }}>
        {aba === "empresa" && (
          <div className="cartao">
            <h2>Empresa</h2>
            <FormAcao action={salvarConta}>
              <fieldset disabled={!dono} style={{ border: 0, padding: 0, margin: 0 }}>
                <div className="campo">
                  <label htmlFor="nome">Nome da conta</label>
                  <input id="nome" name="nome" defaultValue={ctx.conta.nome} />
                </div>
                {ctx.conta.tipo === "ASSESSORIA" && (
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="marcaNome">Nome nos PDFs</label>
                      <input id="marcaNome" name="marcaNome" defaultValue={ctx.conta.marcaNome ?? ""} />
                    </div>
                    <div className="campo">
                      <label htmlFor="marcaCor">Cor nos PDFs</label>
                      <input id="marcaCor" name="marcaCor" defaultValue={ctx.conta.marcaCor ?? ""} placeholder="#1E7A55" />
                    </div>
                  </div>
                )}
                <label className="check" style={{ marginBottom: 16 }}>
                  <input type="checkbox" name="mostrarValoresWhatsapp" defaultChecked={ctx.conta.mostrarValoresWhatsapp} />
                  Mostrar valores em dinheiro nas mensagens de WhatsApp
                </label>
                {dono && <BotaoEnvio>Salvar</BotaoEnvio>}
              </fieldset>
            </FormAcao>
            <hr className="regua" />
            <h3>Empresas desta conta</h3>
            <ul>
              {ctx.empresas.map((e) => (
                <li key={e.id}>
                  {e.razaoSocial} {e.exemplo && <SeloSimples texto="Exemplo fictício" tom="azul" />}
                </li>
              ))}
            </ul>
          </div>
        )}
        {aba === "pessoas" && <Pessoas dono={dono} />}
        {aba === "avisos" && <AvisosPrefs />}
        {aba === "cobranca" && <Cobranca dono={dono} />}
        {aba === "seguranca" && <Seguranca />}
        {aba === "dados" && (
          <div className="pilha">
            <div className="cartao">
              <h2>Exportar tudo</h2>
              <p className="secundario">Um arquivo ZIP com todos os dados da conta em JSON e os documentos enviados.</p>
              {dono ? (
                <a href="/api/exportar" className="btn">
                  Exportar tudo
                </a>
              ) : (
                <p className="legenda">Só o Dono exporta os dados da conta.</p>
              )}
            </div>
            {dono && (
              <div className="cartao" style={{ borderColor: "var(--selo-carimbo-tx)" }}>
                <h2>Excluir conta</h2>
                <p className="secundario">Apaga a conta, os contratos, os pedidos e os documentos. Não dá para desfazer. Exporte antes se quiser guardar.</p>
                <FormAcao action={excluirConta} confirmar="Excluir a conta e todos os dados? Não dá para desfazer.">
                  <div className="campo">
                    <label htmlFor="confirmacao">Digite EXCLUIR para confirmar</label>
                    <input id="confirmacao" name="confirmacao" autoComplete="off" style={{ maxWidth: 220 }} />
                  </div>
                  <BotaoEnvio className="btn btn-perigo">Excluir conta</BotaoEnvio>
                </FormAcao>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

async function Pessoas({ dono }: { dono: boolean }) {
  const ctx = await contexto();
  const membros = await db.membro.findMany({ where: { contaId: ctx.conta.id }, include: { usuario: true }, orderBy: { criadoEm: "asc" } });
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Pessoas e papéis</h2>
        <p className="legenda">Dono: tudo. Gerente de contratos: carteira e pedidos. Contador: memória e aprovação. Leitura: só vê.</p>
        <ul className="lista-limpa pilha-8">
          {membros.map((m) => (
            <li key={m.id} className="entre cartao-linha">
              <span>
                <strong>{m.usuario.nome}</strong>
                <span className="legenda">{m.usuario.email}</span>
              </span>
              {dono ? (
                <div className="fileira">
                  <FormAcao action={mudarPapel} className="fileira">
                    <input type="hidden" name="membroId" value={m.id} />
                    <label htmlFor={`papel-${m.id}`} className="sr-only">
                      Papel
                    </label>
                    <select id={`papel-${m.id}`} name="papel" defaultValue={m.papel} style={{ width: "auto" }}>
                      {Object.entries(NOME_PAPEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <BotaoEnvio className="btn btn-pequeno">Salvar</BotaoEnvio>
                  </FormAcao>
                  {m.usuarioId !== ctx.usuario.id && (
                    <FormAcao action={removerPessoa} confirmar={`Remover ${m.usuario.nome} da conta?`}>
                      <input type="hidden" name="membroId" value={m.id} />
                      <button className="btn btn-texto btn-pequeno" type="submit">
                        Remover
                      </button>
                    </FormAcao>
                  )}
                </div>
              ) : (
                <span>{NOME_PAPEL[m.papel]}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {dono && (
        <div className="cartao">
          <h2>Adicionar pessoa</h2>
          <FormAcao action={convidarPessoa} limparAoSalvar>
            <div className="linha-form">
              <div className="campo">
                <label htmlFor="c-nome">Nome</label>
                <input id="c-nome" name="nome" />
              </div>
              <div className="campo">
                <label htmlFor="c-email">E-mail</label>
                <input id="c-email" name="email" type="email" />
              </div>
              <div className="campo">
                <label htmlFor="c-papel">Papel</label>
                <select id="c-papel" name="papel" defaultValue="GERENTE">
                  {Object.entries(NOME_PAPEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <BotaoEnvio>Adicionar</BotaoEnvio>
          </FormAcao>
        </div>
      )}
    </div>
  );
}

function Canal({ nome, rotulo, valor }: { nome: string; rotulo: string; valor: string }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <select id={nome} name={nome} defaultValue={valor}>
        <option value="AMBOS">E-mail e WhatsApp</option>
        <option value="EMAIL">Só e-mail</option>
        <option value="WHATSAPP">Só WhatsApp</option>
      </select>
    </div>
  );
}

async function AvisosPrefs() {
  const ctx = await contexto();
  const p = prefsDe(ctx.usuario);
  return (
    <div className="cartao">
      <h2>Avisos</h2>
      {(!emailAtivo() || !whatsappAtivo()) && (
        <p className="aviso-caixa info">
          Modo simulação ativo para {[!emailAtivo() && "e-mail", !whatsappAtivo() && "WhatsApp"].filter(Boolean).join(" e ")}. Veja as mensagens montadas em{" "}
          <Link href="/app/avisos">Avisos</Link>.
        </p>
      )}
      <FormAcao action={salvarAvisos}>
        <div className="linha-form">
          <Canal nome="prazo" rotulo="Prazos (60, 30 e 7 dias)" valor={p.prazo} />
          <Canal nome="resposta" rotulo="Prazo de resposta do órgão" valor={p.resposta} />
          <Canal nome="deferido" rotulo="Pedido deferido" valor={p.deferido} />
        </div>
        <div className="linha-form">
          <label className="check" style={{ alignSelf: "center" }}>
            <input type="checkbox" name="semanal" defaultChecked={p.semanal} /> Resumo semanal por e-mail, às segundas
          </label>
          <div className="campo">
            <label htmlFor="hora">Horário do resumo</label>
            <select id="hora" name="hora" defaultValue={p.hora}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" type="tel" defaultValue={ctx.usuario.whatsapp ?? ""} aria-describedby="whats-ajuda" style={{ maxWidth: 260 }} />
          <span id="whats-ajuda" className="ajuda">
            WhatsApp, para os avisos de prazo. Nada de propaganda. Responda SAIR para parar.
          </span>
        </div>
        <label className="check" style={{ marginBottom: 16 }}>
          <input type="checkbox" name="consentimento" defaultChecked={!!ctx.usuario.whatsappConsentEm} />
          Autorizo a Equapar a me mandar avisos de prazo pelo WhatsApp.
        </label>
        {ctx.usuario.whatsappConsentEm && <p className="legenda">Autorização registrada em {dataHora(ctx.usuario.whatsappConsentEm)}.</p>}
        <BotaoEnvio>Salvar</BotaoEnvio>
      </FormAcao>
    </div>
  );
}

async function Cobranca({ dono }: { dono: boolean }) {
  const ctx = await contexto();
  const agg = await db.contrato.aggregate({ where: { arquivado: false, maoDeObraDedicada: true, empresa: { contaId: ctx.conta.id } }, _sum: { postos: true } });
  const postos = agg._sum.postos ?? 0;
  const valor = ctx.conta.plano === "CARTEIRA" ? Math.max(297, 4 * postos) : ctx.conta.plano === "ASSESSORIA" ? 1497 : 0;
  const faturas = await db.fatura.findMany({ where: { contaId: ctx.conta.id }, orderBy: { criadoEm: "desc" } });
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Plano</h2>
        <dl className="dl-resumo">
          <dt>Plano atual</dt>
          <dd>{PLANOS.find((p) => p.id === ctx.conta.plano)?.nome}</dd>
          <dt>Postos contados</dt>
          <dd>{postos} (contratos ativos com mão de obra dedicada)</dd>
          <dt>Valor mensal</dt>
          <dd>{ctx.conta.plano === "PILOTO" ? "por pedido (a partir de R$ 1.500)" : reais(valor)}</dd>
        </dl>
        <p className="aviso-caixa info mt-16">O pagamento online ainda não está integrado. A mudança de plano fica registrada e a cobrança é feita à parte.</p>
        {dono && (
          <FormAcao action={mudarPlano} className="mt-16">
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
              <legend className="rotulo" style={{ marginBottom: 8 }}>
                Mudar de plano
              </legend>
              <div className="pilha-8">
                {PLANOS.map((p) => (
                  <label key={p.id} className="check">
                    <input type="radio" name="plano" value={p.id} defaultChecked={ctx.conta.plano === p.id} />
                    <span>
                      <strong>{p.nome}</strong> <span className="legenda">{p.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <BotaoEnvio className="btn">Salvar plano</BotaoEnvio>
          </FormAcao>
        )}
      </div>
      <div className="cartao">
        <h2>Faturas</h2>
        {faturas.length === 0 ? (
          <p className="secundario">Nenhuma fatura ainda.</p>
        ) : (
          <ul className="lista-limpa pilha-8">
            {faturas.map((f) => (
              <li key={f.id} className="entre">
                <span>
                  {f.referencia} · {f.descricao}
                </span>
                <span className="num">
                  {reais(f.valor)} {f.pagaEm ? "· paga" : "· em aberto"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function Seguranca() {
  const ctx = await contexto();
  const sessoes = await db.sessao.findMany({ where: { usuarioId: ctx.usuario.id, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: "desc" } });
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Verificação em duas etapas</h2>
        <DoisFatores ativo={ctx.usuario.totpAtivo} />
      </div>
      <div className="cartao">
        <h2>Trocar senha</h2>
        <FormAcao action={trocarSenha} limparAoSalvar>
          {ctx.usuario.senhaHash && (
            <div className="campo">
              <label htmlFor="atual">Senha atual</label>
              <input id="atual" name="atual" type="password" autoComplete="current-password" style={{ maxWidth: 320 }} />
            </div>
          )}
          <div className="campo">
            <label htmlFor="nova">Nova senha</label>
            <input id="nova" name="nova" type="password" autoComplete="new-password" style={{ maxWidth: 320 }} aria-describedby="nova-ajuda" />
            <span id="nova-ajuda" className="ajuda">
              Pelo menos 10 caracteres, com letras e números.
            </span>
          </div>
          <BotaoEnvio className="btn">Trocar senha</BotaoEnvio>
        </FormAcao>
      </div>
      <div className="cartao">
        <h2>Sessões abertas</h2>
        <ul className="lista-limpa pilha-8">
          {sessoes.map((s) => (
            <li key={s.id} className="entre" style={{ fontSize: 14 }}>
              <span>
                {s.userAgent?.slice(0, 80) ?? "Navegador desconhecido"}
                <span className="legenda" style={{ display: "block" }}>
                  desde {dataHora(s.criadoEm)}
                </span>
              </span>
              {s.id === ctx.sessaoId ? (
                <SeloSimples texto="Esta sessão" tom="verde" />
              ) : (
                <FormAcao action={encerrarOutraSessao}>
                  <input type="hidden" name="sessaoId" value={s.id} />
                  <button type="submit" className="btn btn-pequeno">
                    Encerrar
                  </button>
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
