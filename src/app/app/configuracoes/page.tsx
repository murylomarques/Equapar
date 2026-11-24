import type { Metadata } from "next";
import Link from "next/link";
import { Monitor } from "lucide-react";
import { contexto, ehDemo, NOME_PAPEL, pode } from "@/lib/auth";
import { PRECOS, situacaoEfetiva, valorDoPlano } from "@/lib/planos";
import { cobranca, simulacaoPermitida } from "@/lib/cobranca";
import { resumoAssinatura } from "@/lib/cobranca-servidor";
import { preverMudanca } from "@/lib/assinatura";
import type { PlanoId } from "@/lib/planos";
import { db } from "@/lib/db";
import { prefsDe } from "@/lib/avisos";
import { data, dataHora, reais } from "@/lib/format";
import { navegadorLegivel, plural } from "@/lib/mascaras";
import { emailAtivo, whatsappAtivo } from "@/lib/mensagens";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { SeloSimples } from "@/components/selo";
import { AreaArquivo } from "@/components/ui/arquivo";
import { CampoSelect, CampoTexto, Consentimento, Interruptor, RadiosCartao } from "@/components/ui/campos";
import { Alerta, CabecalhoPagina } from "@/components/ui/estrutura";
import { DoisFatores } from "./dois-fatores";
import { AcompanharExportacao } from "./componentes";
import {
  convidarPessoa,
  encerrarOutraSessao,
  encerrarOutrasSessoes,
  excluirConta,
  exportarEmFundo,
  mudarPapel,
  mudarPlano,
  simularEventoFatura,
  removerLogo,
  removerPessoa,
  salvarAvisos,
  salvarConta,
  salvarLogo,
  trocarSenha,
} from "./acoes";
import { CampoSenha } from "@/components/ui/campos";

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
  { valor: "GRATIS", titulo: "Raio-X (grátis)", descricao: "Carteira e prazos. Montar pedidos faz parte do piloto ou da assinatura." },
  { valor: "PILOTO", titulo: "Piloto", descricao: "A partir de R$ 1.500 por pedido." },
  { valor: "CARTEIRA", titulo: "Carteira", descricao: "R$ 4 por posto por mês, mínimo R$ 297." },
  { valor: "ASSESSORIA", titulo: "Assessoria", descricao: "A partir de R$ 1.497 por mês, vários clientes." },
];

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ aba?: string; plano?: string; ciclo?: string }> }) {
  const ctx = await contexto();
  const { aba = "empresa", plano: planoPrevisto, ciclo: cicloPrevisto } = await searchParams;
  const dono = pode(ctx.papel, "gerenciar_conta");
  const demo = ehDemo(ctx);
  return (
    <>
      <CabecalhoPagina titulo="Configurações" />
      <nav className="abas" aria-label="Seções">
        {ABAS.map(([k, n]) => (
          <Link key={k} href={`/app/configuracoes?aba=${k}`} aria-current={aba === k ? "page" : undefined} scroll={false}>
            {n}
          </Link>
        ))}
      </nav>
      {demo && (
        <Alerta tipo="info" className="mb-16">
          Na demonstração, as configurações são só para ver. <Link href="/criar-conta">Crie sua conta para usar</Link>.
        </Alerta>
      )}
      <div style={{ maxWidth: 820 }}>
        {aba === "empresa" && <Empresa dono={dono} />}
        {aba === "pessoas" && <Pessoas dono={dono} />}
        {aba === "avisos" && <AvisosPrefs demo={demo} />}
        {aba === "cobranca" && <Cobranca dono={dono} planoPrevisto={planoPrevisto} cicloPrevisto={cicloPrevisto} />}
        {aba === "seguranca" && <Seguranca demo={demo} />}
        {aba === "dados" && <Dados dono={dono} />}
      </div>
    </>
  );
}

async function Empresa({ dono }: { dono: boolean }) {
  const ctx = await contexto();
  const assessoria = ctx.conta.tipo === "ASSESSORIA";
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Empresa</h2>
        <FormAcao action={salvarConta}>
          <fieldset disabled={!dono} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <CampoTexto nome="nome" rotulo="Nome da conta" valorInicial={ctx.conta.nome} />
            {assessoria && (
              <div className="linha-form">
                <CampoTexto nome="marcaNome" rotulo="Nome nos PDFs" opcional valorInicial={ctx.conta.marcaNome} />
                <CampoTexto nome="marcaCor" rotulo="Cor nos PDFs" opcional valorInicial={ctx.conta.marcaCor} largura="curto" ajuda="Ex.: #1E7A55" />
              </div>
            )}
            <Interruptor
              nome="mostrarValoresWhatsapp"
              rotulo="Mostrar valores em dinheiro no WhatsApp"
              descricao="Desligado, as mensagens citam o contrato e o prazo, sem valores."
              valorInicial={ctx.conta.mostrarValoresWhatsapp}
              desabilitado={!dono}
            />
            {dono && (
              <div className="mt-16">
                <BotaoEnvio>Salvar</BotaoEnvio>
              </div>
            )}
          </fieldset>
        </FormAcao>
        <hr className="regua" />
        <h3>{plural(ctx.empresas.length, "empresa nesta conta", "empresas nesta conta")}</h3>
        <ul className="lista-limpa pilha-8">
          {ctx.empresas.map((e) => (
            <li key={e.id} className="fileira">
              {e.razaoSocial} {e.exemplo && <SeloSimples texto="Exemplo fictício" tom="azul" />}
            </li>
          ))}
        </ul>
      </div>
      {assessoria && (
        <div className="cartao">
          <h2>Logo nos PDFs</h2>
          <p className="secundario">Aparece no topo do ofício e da memória de cálculo gerados para os seus clientes.</p>
          {ctx.conta.marcaLogo && (
            <div className="fileira mb-16" style={{ gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/conta/logo" alt="Logo atual da assessoria" style={{ maxHeight: 56, maxWidth: 200, border: "1px solid var(--linha)", borderRadius: 6, padding: 6, background: "#fff" }} />
              {dono && (
                <FormAcao action={removerLogo} confirmar={{ titulo: "Remover o logo?", texto: "Os próximos PDFs saem sem logo.", confirmar: "Remover", perigo: true }}>
                  <BotaoEnvio className="btn btn-discreto">Remover logo</BotaoEnvio>
                </FormAcao>
              )}
            </div>
          )}
          {dono && (
            <FormAcao action={salvarLogo} limparAoSalvar>
              <AreaArquivo tipos={["imagem"]} limiteMb={2} />
              <div className="mt-16">
                <BotaoEnvio>Salvar logo</BotaoEnvio>
              </div>
            </FormAcao>
          )}
        </div>
      )}
    </div>
  );
}

async function Pessoas({ dono }: { dono: boolean }) {
  const ctx = await contexto();
  const membros = await db.membro.findMany({ where: { contaId: ctx.conta.id }, include: { usuario: true }, orderBy: { criadoEm: "asc" } });
  const papeis = Object.entries(NOME_PAPEL).map(([valor, rotulo]) => ({ valor, rotulo }));
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Pessoas e papéis</h2>
        <p className="ajuda-texto">Dono: tudo. Gerente de contratos: carteira e pedidos. Contador: memória e aprovação. Leitura: só vê.</p>
        <ul className="lista-limpa pilha-8">
          {membros.map((m) => (
            <li key={m.id} className="cartao-linha entre" style={{ boxShadow: "none" }}>
              <span style={{ minWidth: 0 }}>
                <strong>{m.usuario.nome}</strong>
                <span className="legenda">{m.usuario.email}</span>
              </span>
              {dono ? (
                <div className="fileira">
                  <FormAcao action={mudarPapel} className="fileira">
                    <input type="hidden" name="membroId" value={m.id} />
                    <label htmlFor={`papel-${m.id}`} className="sr-only">
                      Papel de {m.usuario.nome}
                    </label>
                    <select id={`papel-${m.id}`} name="papel" defaultValue={m.papel} style={{ width: "auto", minHeight: 36 }}>
                      {papeis.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                    <BotaoEnvio className="btn btn-pequeno">Salvar</BotaoEnvio>
                  </FormAcao>
                  {m.usuarioId !== ctx.usuario.id && (
                    <FormAcao action={removerPessoa} confirmar={{ titulo: `Remover ${m.usuario.nome} da conta?`, texto: "A pessoa perde o acesso imediatamente.", confirmar: "Remover", perigo: true }}>
                      <input type="hidden" name="membroId" value={m.id} />
                      <BotaoEnvio className="btn btn-discreto btn-pequeno">Remover</BotaoEnvio>
                    </FormAcao>
                  )}
                </div>
              ) : (
                <SeloSimples texto={NOME_PAPEL[m.papel]} tom="neutro" />
              )}
            </li>
          ))}
        </ul>
      </div>
      {dono && (
        <div className="cartao">
          <h2>Adicionar pessoa</h2>
          <FormAcao action={convidarPessoa} limparAoSalvar okNaPagina>
            <CampoTexto nome="nome" rotulo="Nome" />
            <CampoTexto nome="email" rotulo="E-mail" tipo="email" />
            <CampoSelect nome="papel" rotulo="Papel" valorInicial="GERENTE" opcoes={papeis} largura="medio" />
            <BotaoEnvio>Adicionar pessoa</BotaoEnvio>
          </FormAcao>
        </div>
      )}
    </div>
  );
}

async function AvisosPrefs({ demo }: { demo: boolean }) {
  const ctx = await contexto();
  const p = prefsDe(ctx.usuario);
  const semCanal = [!emailAtivo() && "e-mail", !whatsappAtivo() && "WhatsApp"].filter(Boolean) as string[];
  const canais = [
    { valor: "AMBOS", rotulo: "E-mail e WhatsApp" },
    { valor: "EMAIL", rotulo: "Só e-mail" },
    { valor: "WHATSAPP", rotulo: "Só WhatsApp" },
  ];
  return (
    <div className="cartao">
      <h2>Avisos</h2>
      {semCanal.length > 0 && (
        <Alerta tipo="info" className="mb-16" titulo="Modo simulação">
          {semCanal.join(" e ")} {semCanal.length > 1 ? "ainda não estão ligados" : "ainda não está ligado"}. As mensagens ficam registradas em <Link href="/app/avisos">Avisos</Link>.
        </Alerta>
      )}
      <FormAcao action={salvarAvisos}>
        <fieldset disabled={demo} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <fieldset className="grupo-form">
            <legend>Por onde avisar</legend>
            <CampoSelect nome="prazo" rotulo="Prazos (60, 30 e 7 dias)" valorInicial={p.prazo} opcoes={canais} largura="medio" />
            <CampoSelect nome="resposta" rotulo="Prazo de resposta do órgão" valorInicial={p.resposta} opcoes={canais} largura="medio" />
            <CampoSelect nome="deferido" rotulo="Pedido deferido" valorInicial={p.deferido} opcoes={canais} largura="medio" />
          </fieldset>
          <fieldset className="grupo-form">
            <legend>Resumo semanal</legend>
            <Interruptor nome="semanal" rotulo="Resumo por e-mail às segundas" descricao="Prazos da semana, pedidos no órgão e valores a receber." valorInicial={p.semanal} />
            <div className="mt-16">
              <CampoSelect
                nome="hora"
                rotulo="Horário do resumo"
                valorInicial={String(p.hora)}
                largura="curto"
                opcoes={Array.from({ length: 16 }, (_, i) => i + 6).map((h) => ({ valor: String(h), rotulo: `${h}h` }))}
              />
            </div>
          </fieldset>
          <fieldset className="grupo-form">
            <legend>WhatsApp</legend>
            <CampoTexto nome="whatsapp" rotulo="Número" opcional tipo="tel" inputMode="tel" valorInicial={ctx.usuario.whatsapp} largura="medio" ajuda="Só para avisos de prazo. Nada de propaganda. Responda SAIR para parar." />
            <Consentimento nome="consentimento">Autorizo a Equapar a me mandar avisos de prazo pelo WhatsApp.</Consentimento>
            {ctx.usuario.whatsappConsentEm && <p className="legenda">Autorização registrada em {dataHora(ctx.usuario.whatsappConsentEm)}. Para manter, marque de novo ao salvar.</p>}
          </fieldset>
          {!demo && <BotaoEnvio>Salvar preferências</BotaoEnvio>}
        </fieldset>
      </FormAcao>
    </div>
  );
}

const SITUACAO: Record<string, { tom: "info" | "atencao" | "erro"; texto: string }> = {
  ATRASADA: { tom: "atencao", texto: "O último pagamento não foi identificado. Vamos tentar de novo; para pagar agora, use o link da fatura." },
  CARENCIA: {
    tom: "erro",
    texto: "Depois de 3 tentativas, o pagamento não foi identificado. A conta continua funcionando até o fim da carência; depois, fica só para consulta. Nenhum dado é apagado.",
  },
  SOMENTE_LEITURA: { tom: "erro", texto: "A conta está só para consulta porque o pagamento não foi identificado. Pague a fatura em aberto para voltar a editar. Nenhum dado foi apagado." },
};

const STATUS_FATURA: Record<string, string> = { ABERTA: "em aberto", PAGA: "paga", FALHOU: "não paga", CANCELADA: "cancelada", ESTORNADA: "estornada" };
const REVISAO: Record<string, string> = {
  PAGA_APOS_CANCELAMENTO: "Pagamento recebido depois do cancelamento: não reativa o plano; o valor será devolvido.",
  ESTORNO_PARCIAL: "Estorno parcial registrado: o acesso do período foi mantido.",
  CHARGEBACK: "Contestação aberta no cartão: o acesso segue até a decisão.",
};
const NOME_PLANO_CURTO: Record<string, string> = { GRATIS: "Grátis", PILOTO: "Piloto", CARTEIRA: "Carteira", ASSESSORIA: "Assessoria" };

async function Cobranca({ dono, planoPrevisto, cicloPrevisto }: { dono: boolean; planoPrevisto?: string; cicloPrevisto?: string }) {
  const ctx = await contexto();
  const agora = new Date();
  const a = await resumoAssinatura(ctx.conta.id, agora);
  const { conta, faturas, postos, ciclo } = a;
  const situacao = situacaoEfetiva(conta.situacaoCobranca, conta.carenciaAte);
  const simulacao = cobranca().modo === "simulacao";
  const podeSimular = simulacaoPermitida();
  const ativo = !!conta.planoVigenteAte && conta.planoVigenteAte > agora && conta.plano !== "GRATIS";
  const destino = (["GRATIS", "PILOTO", "CARTEIRA", "ASSESSORIA"] as const).find((p) => p === planoPrevisto) as PlanoId | undefined;
  const cicloNovo = cicloPrevisto === "ANUAL" ? "ANUAL" : cicloPrevisto === "MENSAL" ? "MENSAL" : ciclo;
  const previsao = destino ? preverMudanca(conta, destino, agora, cicloNovo) : null;
  const valorPrevisto = destino && (destino === "CARTEIRA" || destino === "ASSESSORIA") ? valorDoPlano(destino, { postos, ciclo: cicloNovo }).toFixed(2) : null;
  const base = (plano: string) =>
    plano === "CARTEIRA"
      ? `${plural(postos, "posto", "postos")} × R$ ${PRECOS.carteiraPorPosto} por mês, mínimo de ${reais(PRECOS.carteiraMinimo.toFixed(2))}`
      : plano === "ASSESSORIA"
        ? "valor fixo mensal"
        : "";
  return (
    <div className="pilha">
      {SITUACAO[situacao] && (
        <Alerta tipo={SITUACAO[situacao].tom} titulo={situacao === "CARENCIA" && conta.carenciaAte ? `Carência até ${data(conta.carenciaAte)}` : undefined}>
          {SITUACAO[situacao].texto}
        </Alerta>
      )}

      <section className="cartao" aria-labelledby="assinatura">
        <h2 id="assinatura">Sua assinatura</h2>
        <dl className="dl-resumo">
          <dt>Plano atual</dt>
          <dd>{PLANOS.find((p) => p.valor === conta.plano)?.titulo}</dd>
          {ativo && (
            <>
              <dt>Período pago até</dt>
              <dd>{data(conta.planoVigenteAte)}</dd>
              <dt>Ciclo</dt>
              <dd>{ciclo === "ANUAL" ? "Anual" : "Mensal"}</dd>
            </>
          )}
          {ativo && !conta.renovacaoCancelada && a.valorRenovacao && (
            <>
              <dt>Próxima cobrança</dt>
              <dd className="tnum">
                {reais(a.valorRenovacao)} em {data(conta.planoVigenteAte)}
                <span className="legenda" style={{ display: "block" }}>
                  {base(conta.mudancaAgendada && conta.mudancaAgendada !== "GRATIS" ? conta.mudancaAgendada : conta.plano)}. O valor é recalculado na data com os postos ativos.
                </span>
              </dd>
            </>
          )}
          {conta.plano === "PILOTO" && (
            <>
              <dt>Valor</dt>
              <dd>por pedido (a partir de {reais(PRECOS.pilotoPorPedido.toFixed(2))})</dd>
            </>
          )}
          {conta.mudancaAgendada && conta.mudancaAgendadaEm && (
            <>
              <dt>Mudança programada</dt>
              <dd>
                {conta.mudancaAgendada === "GRATIS" ? "Renovação cancelada: passa para o Grátis" : `Passa para o plano ${NOME_PLANO_CURTO[conta.mudancaAgendada]}`} em {data(conta.mudancaAgendadaEm)}.
              </dd>
            </>
          )}
          {a.pendenteCompra && (
            <>
              <dt>Aguardando pagamento</dt>
              <dd>{NOME_PLANO_CURTO[a.pendenteCompra.plano ?? ""] ?? a.pendenteCompra.descricao}: passa a valer quando o pagamento for confirmado.</dd>
            </>
          )}
        </dl>
        {dono && ativo && (
          <div className="fileira mt-16">
            {conta.renovacaoCancelada ? (
              <Link className="btn" href={`/app/configuracoes?aba=cobranca&plano=${conta.plano}#previsao`} scroll={false}>
                Manter a assinatura
              </Link>
            ) : (
              <Link className="btn btn-discreto" href="/app/configuracoes?aba=cobranca&plano=GRATIS#previsao" scroll={false}>
                Cancelar a renovação
              </Link>
            )}
          </div>
        )}
        {simulacao && (
          <Alerta tipo="info" className="mt-16">
            Pagamento em modo simulação: nenhuma cobrança real é feita.{podeSimular ? " Cada fatura em aberto tem os botões para simular o pagamento ou o vencimento." : ""}
          </Alerta>
        )}
      </section>

      {dono && (
        <section className="cartao" aria-labelledby="mudar">
          <h2 id="mudar">Mudar de plano</h2>
          <form method="get" action="/app/configuracoes" className="pilha-16">
            <input type="hidden" name="aba" value="cobranca" />
            <RadiosCartao nome="plano" legenda="Plano" valorInicial={destino ?? conta.plano} opcoes={PLANOS} />
            <CampoSelect
              nome="ciclo"
              rotulo="Ciclo"
              valorInicial={cicloNovo}
              opcoes={[
                { valor: "MENSAL", rotulo: "Mensal" },
                { valor: "ANUAL", rotulo: PRECOS.descontoAnualPct() ? `Anual (${PRECOS.descontoAnualPct()}% de desconto)` : "Anual" },
              ]}
            />
            <div>
              <button type="submit" className="btn">
                Ver o que muda
              </button>
            </div>
          </form>
          {previsao && destino && (
            <div id="previsao" className="mt-24">
              <Alerta tipo={previsao.possivel ? "info" : "atencao"} titulo={previsao.titulo}>
                {valorPrevisto && previsao.efeito !== "REATIVAR" && (
                  <p className="tnum mb-8">
                    <strong>{reais(valorPrevisto)}</strong> por {cicloNovo === "ANUAL" ? "ano" : "mês"} · {base(destino)}
                  </p>
                )}
                <ul className="mb-0">
                  {previsao.linhas.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </Alerta>
              {previsao.possivel && (
                <FormAcao action={mudarPlano} className="mt-16">
                  <input type="hidden" name="plano" value={destino} />
                  <input type="hidden" name="ciclo" value={cicloNovo} />
                  {destino === "GRATIS" && (
                    <CampoSelect
                      nome="motivo"
                      rotulo="Quer contar o motivo? (opcional)"
                      valorInicial=""
                      opcoes={[
                        { valor: "", rotulo: "Prefiro não dizer" },
                        { valor: "PRECO", rotulo: "Preço" },
                        { valor: "POUCO_USO", rotulo: "Uso pouco" },
                        { valor: "FALTOU_FUNCAO", rotulo: "Faltou alguma função" },
                        { valor: "TEMPORARIO", rotulo: "Pausa temporária" },
                        { valor: "OUTRO", rotulo: "Outro motivo" },
                      ]}
                    />
                  )}
                  {previsao.efeito === "IMEDIATO_APOS_PAGAMENTO" && (
                    <CampoSelect
                      nome="metodo"
                      rotulo="Forma de pagamento"
                      valorInicial="ESCOLHER"
                      opcoes={[
                        { valor: "ESCOLHER", rotulo: "Escolher na hora de pagar" },
                        { valor: "PIX", rotulo: "Pix" },
                        { valor: "BOLETO", rotulo: "Boleto" },
                        { valor: "CARTAO", rotulo: "Cartão de crédito" },
                      ]}
                    />
                  )}
                  <BotaoEnvio className={destino === "GRATIS" ? "btn btn-perigo" : "btn btn-primario"}>
                    {previsao.efeito === "IMEDIATO_APOS_PAGAMENTO"
                      ? "Abrir a cobrança"
                      : previsao.efeito === "REATIVAR"
                        ? "Manter a assinatura"
                        : destino === "GRATIS"
                          ? "Confirmar o cancelamento"
                          : "Confirmar a mudança"}
                  </BotaoEnvio>
                </FormAcao>
              )}
            </div>
          )}
        </section>
      )}

      <section className="cartao" aria-labelledby="faturas">
        <h2 id="faturas">Faturas</h2>
        {faturas.length === 0 ? (
          <p className="secundario mb-0">Nenhuma fatura ainda.</p>
        ) : (
          <ul className="lista-limpa pilha-8">
            {faturas.map((f) => (
              <li key={f.id} className="item-doc">
                <div className="entre" style={{ alignItems: "flex-start" }}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{f.descricao}</strong>
                    <span className="legenda" style={{ display: "block" }}>
                      {f.periodoInicio && f.periodoFim ? `Período ${data(f.periodoInicio)} a ${data(f.periodoFim)}` : f.referencia}
                      {f.vencimento && (f.status === "ABERTA" || f.status === "FALHOU") ? ` · vence em ${data(f.vencimento)}` : ""}
                      {f.tentativas ? ` · ${plural(f.tentativas, "tentativa", "tentativas")}` : ""}
                      {f.motivoCancelamento ? ` · ${f.motivoCancelamento}` : ""}
                    </span>
                    {f.revisao && REVISAO[f.revisao] && (
                      <span className="legenda" style={{ display: "block" }}>
                        {REVISAO[f.revisao]}
                      </span>
                    )}
                  </span>
                  <span className="num">
                    {reais(f.valor)} · {STATUS_FATURA[f.status] ?? f.status}
                    {Number(f.valorEstornado) > 0 && f.status !== "ESTORNADA" ? ` · ${reais(f.valorEstornado)} estornado` : ""}
                  </span>
                </div>
                <div className="fileira mt-8">
                  {(f.status === "ABERTA" || f.status === "FALHOU") && f.linkPagamento && !f.linkPagamento.startsWith("/") && (
                    <a className="btn btn-pequeno btn-primario" href={f.linkPagamento} target="_blank" rel="noopener noreferrer">
                      Pagar
                    </a>
                  )}
                  {f.status === "PAGA" &&
                    !f.revisao &&
                    (f.notaFiscalUrl ? (
                      <a className="btn btn-pequeno" href={f.notaFiscalUrl}>
                        Baixar a nota fiscal
                      </a>
                    ) : (
                      <span className="legenda">Nota fiscal: emitida depois do pagamento.</span>
                    ))}
                  {podeSimular && dono && (f.status === "ABERTA" || f.status === "FALHOU") && (
                    <>
                      <FormAcao action={simularEventoFatura}>
                        <input type="hidden" name="faturaId" value={f.id} />
                        <input type="hidden" name="evento" value="PAGO" />
                        <BotaoEnvio className="btn btn-pequeno">Simular pagamento</BotaoEnvio>
                      </FormAcao>
                      <FormAcao action={simularEventoFatura}>
                        <input type="hidden" name="faturaId" value={f.id} />
                        <input type="hidden" name="evento" value="VENCIDO" />
                        <BotaoEnvio className="btn btn-pequeno btn-discreto">Simular vencimento</BotaoEnvio>
                      </FormAcao>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function Seguranca({ demo }: { demo: boolean }) {
  const ctx = await contexto();
  const sessoes = await db.sessao.findMany({ where: { usuarioId: ctx.usuario.id, expiraEm: { gt: new Date() } }, orderBy: { criadoEm: "desc" } });
  const outras = sessoes.filter((s) => s.id !== ctx.sessaoId).length;
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Verificação em duas etapas</h2>
        {demo ? <p className="secundario mb-0">Indisponível na demonstração.</p> : <DoisFatores ativo={ctx.usuario.totpAtivo} />}
      </div>
      {!demo && (
        <div className="cartao">
          <h2>Trocar senha</h2>
          <FormAcao action={trocarSenha} limparAoSalvar>
            {ctx.usuario.senhaHash && <CampoSenha nome="atual" rotulo="Senha atual" />}
            <CampoSenha nome="nova" rotulo="Nova senha" nova />
            <BotaoEnvio className="btn">Trocar senha</BotaoEnvio>
          </FormAcao>
        </div>
      )}
      <div className="cartao">
        <div className="cartao-cab">
          <h2>Sessões abertas</h2>
          {outras > 0 && (
            <FormAcao action={encerrarOutrasSessoes} confirmar={{ titulo: "Encerrar as outras sessões?", texto: "Quem estiver usando sua conta em outro navegador precisa entrar de novo.", confirmar: "Encerrar", perigo: true }}>
              <BotaoEnvio className="btn btn-pequeno">Encerrar as outras sessões</BotaoEnvio>
            </FormAcao>
          )}
        </div>
        <ul className="lista-limpa pilha-8">
          {sessoes.map((s) => (
            <li key={s.id} className="entre" style={{ fontSize: 14 }}>
              <span className="fileira" style={{ flexWrap: "nowrap" }}>
                <Monitor size={18} strokeWidth={1.5} aria-hidden style={{ color: "var(--grafite)" }} />
                <span>
                  {navegadorLegivel(s.userAgent)}
                  <span className="legenda" style={{ display: "block" }}>
                    desde {dataHora(s.criadoEm)}
                  </span>
                </span>
              </span>
              {s.id === ctx.sessaoId ? (
                <SeloSimples texto="Esta sessão" tom="verde" />
              ) : (
                <FormAcao action={encerrarOutraSessao}>
                  <input type="hidden" name="sessaoId" value={s.id} />
                  <BotaoEnvio className="btn btn-pequeno">Encerrar</BotaoEnvio>
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

async function Dados({ dono }: { dono: boolean }) {
  const ctx = await contexto();
  const ultimo = await db.trabalhoFundo.findFirst({ where: { contaId: ctx.conta.id, tipo: "EXPORTAR" }, orderBy: { criadoEm: "desc" } });
  return (
    <div className="pilha">
      <div className="cartao">
        <h2>Exportar tudo</h2>
        <p className="secundario">Um arquivo ZIP com todos os dados da conta (em JSON) e os documentos enviados. Pode levar alguns minutos; avisamos no sino quando terminar.</p>
        {dono ? (
          <div className="pilha-8">
            <FormAcao action={exportarEmFundo}>
              <BotaoEnvio className="btn" pendente="Iniciando…">
                Exportar tudo
              </BotaoEnvio>
            </FormAcao>
            <AcompanharExportacao status={(ultimo?.status as "RODANDO" | "PRONTO" | "ERRO" | undefined) ?? null} id={ultimo?.id ?? null} />
          </div>
        ) : (
          <p className="legenda">Só o Dono exporta os dados da conta.</p>
        )}
      </div>
      {dono && (
        <div className="cartao" style={{ borderColor: "var(--erro)" }}>
          <h2>Excluir conta</h2>
          <p className="secundario">Apaga a conta, os contratos, os pedidos e os documentos. Não dá para desfazer. Exporte antes se quiser guardar.</p>
          <FormAcao action={excluirConta}>
            <CampoTexto nome="confirmacao" rotulo="Digite EXCLUIR para confirmar" largura="curto" />
            <BotaoEnvio className="btn btn-perigo">Excluir conta</BotaoEnvio>
          </FormAcao>
        </div>
      )}
    </div>
  );
}
