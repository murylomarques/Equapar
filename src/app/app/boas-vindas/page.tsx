import type { Metadata } from "next";
import Link from "next/link";
import { Check, CheckCircle2, Users } from "lucide-react";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { formatarCnpj } from "@/lib/cnpj";
import { data, diasAte, hojeUTC, MESES, plural } from "@/lib/format";
import { ETAPAS_INICIO } from "@/lib/inicio";
import { CampoInteiro, CampoTexto, SelectMes } from "@/components/ui/campos";
import { Alerta } from "@/components/ui/estrutura";
import { EstadoVazio } from "@/components/ui/apresentacao";
import { onboardingConvencoes, onboardingImportar, onboardingMarcar } from "../acoes";
import { contratosDoContexto } from "@/lib/consultas";
import { prazosDoContrato } from "@/lib/prazos";

export const metadata: Metadata = { title: "Primeiros passos | Equapar" };

/** Etapa 0 ("Conta criada") já está feita: é verdade (P11). */
function Progresso({ atual }: { atual: number }) {
  return (
    <ol className="progresso" tabIndex={0} aria-label="Primeiros passos">
      {ETAPAS_INICIO.map((e, i) => (
        <li key={e} className={i < atual ? "feito" : i === atual ? "atual" : undefined} aria-current={i === atual ? "step" : undefined}>
          <span>
            <span className="passo-marca" aria-hidden>
              {i < atual ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            {e}
            {i < atual && <span className="sr-only"> (concluído)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function BoasVindas({ searchParams }: { searchParams: Promise<{ passo?: string }> }) {
  const ctx = await contexto();
  const { passo = "importar" } = await searchParams;
  const empresa = ctx.empresaSelecionada ?? ctx.empresas[0];
  const contratos = await db.contrato.findMany({ where: { arquivado: false, empresa: { contaId: ctx.conta.id } }, orderBy: { vigenciaFim: "asc" } });
  const etapa = { importar: 1, contratos: 1, convencoes: 2, pronto: 3 }[passo] ?? 1;

  return (
    <div style={{ maxWidth: 880 }}>
      <Progresso atual={etapa} />
      <div className="passo-conteudo mt-24">
        {passo === "importar" && <Importar empresa={empresa} temContratos={contratos.length > 0} />}
        {passo === "contratos" && <Marcar contratos={contratos} />}
        {passo === "convencoes" && <Convencoes />}
        {passo === "pronto" && <Pronto />}
      </div>
    </div>
  );
}

function Importar({ empresa, temContratos }: { empresa?: { id: string; cnpj: string; razaoSocial: string }; temContratos: boolean }) {
  if (!empresa)
    return (
      <EstadoVazio
        icone={Users}
        titulo="Adicione o primeiro cliente"
        porque="Assessorias começam cadastrando um cliente pelo CNPJ."
        acao={
          <Link href="/app/clientes" className="btn btn-primario">
            Adicionar cliente
          </Link>
        }
      />
    );
  return (
    <div className="cartao">
      <h1>Vamos buscar seus contratos no PNCP</h1>
      <p className="secundario">
        {empresa.razaoSocial} · CNPJ <span className="tnum">{formatarCnpj(empresa.cnpj)}</span>. A Equapar importa os contratos vigentes publicados no Portal Nacional de Contratações Públicas.
      </p>
      <FormAcao action={onboardingImportar} semToast>
        <input type="hidden" name="empresaId" value={empresa.id} />
        <div className="fileira mt-16">
          <BotaoEnvio pendente="Consultando o PNCP… pode levar até 20 segundos">Importar meus contratos</BotaoEnvio>
          {temContratos && (
            <Link href="/app/boas-vindas?passo=contratos" className="btn">
              Já importei: continuar
            </Link>
          )}
          <Link href="/app/contratos/novo" className="btn btn-discreto">
            Cadastrar à mão
          </Link>
        </div>
      </FormAcao>
    </div>
  );
}

function Marcar({ contratos }: { contratos: { id: string; numero: string; orgao: string; objeto: string; maoDeObraDedicada: boolean; vigenciaFim: Date }[] }) {
  if (!contratos.length)
    return (
      <EstadoVazio
        icone={Users}
        titulo="Não achamos contratos vigentes no PNCP"
        porque="Contratos antigos podem não ter sido publicados. Cadastre à mão e siga em frente."
        acao={
          <Link href="/app/contratos/novo" className="btn btn-primario">
            Cadastrar um contrato à mão
          </Link>
        }
      />
    );
  return (
    <div className="cartao">
      <h1>Achamos {plural(contratos.length, "contrato", "contratos")} no PNCP</h1>
      <p className="secundario">Marque os que têm funcionários seus trabalhando no órgão. Os de limpeza já vêm marcados.</p>
      <FormAcao action={onboardingMarcar} semToast>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Contratos com mão de obra dedicada</legend>
          <ul className="lista-limpa pilha-8">
            {contratos.map((c) => (
              <li key={c.id}>
                <label className="radio-cartao">
                  <input type="checkbox" name="maoDeObra" value={c.id} defaultChecked={c.maoDeObraDedicada} />
                  <span style={{ minWidth: 0 }}>
                    <strong>
                      Contrato {c.numero} · {c.orgao}
                    </strong>
                    <span className="desc" style={{ display: "block" }}>
                      {c.objeto.slice(0, 180)} · termina em {data(c.vigenciaFim)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="rodape-assistente">
          <Link href="/app/boas-vindas" className="btn">
            Voltar
          </Link>
          <BotaoEnvio>Continuar</BotaoEnvio>
        </div>
      </FormAcao>
    </div>
  );
}

async function Convencoes() {
  const ctx = await contexto();
  const contratos = await db.contrato.findMany({
    where: { arquivado: false, maoDeObraDedicada: true, empresa: { contaId: ctx.conta.id } },
    orderBy: [{ uf: "asc" }, { municipio: "asc" }],
  });
  const convs = await db.convencao.findMany({ where: { contaId: ctx.conta.id }, orderBy: { ano: "desc" } });
  const grupos = new Map<string, typeof contratos>();
  for (const c of contratos) {
    const k = `${c.municipio ?? "Cidade não informada"}/${c.uf ?? "--"}`;
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const anoAtual = hojeUTC().getUTCFullYear();
  if (!contratos.length)
    return (
      <div className="cartao">
        <h1>Nenhum contrato com mão de obra marcado</h1>
        <p className="secundario">Sem funcionários dedicados, não há convenção para confirmar.</p>
        <Link href="/app/boas-vindas?passo=pronto" className="btn btn-primario">
          Continuar
        </Link>
      </div>
    );
  return (
    <div className="cartao">
      <h1>Qual convenção coletiva vale para estes contratos?</h1>
      <p className="secundario">Agrupamos por cidade. Use a mesma convenção da planilha de custos da proposta.</p>
      <FormAcao action={onboardingConvencoes} semToast>
        <div className="pilha" style={{ gap: 24 }}>
          {[...grupos.entries()].map(([g, cs], gi) => {
            const chave = `g${gi}`;
            const [cidade, uf] = g.split("/");
            const sugerida = convs.find((c) => c.uf === uf && (!c.cidade || c.cidade === cidade));
            return (
              <fieldset key={g} className="grupo-form" style={{ margin: 0 }}>
                <legend>
                  {g} · {plural(cs.length, "contrato", "contratos")}
                </legend>
                <input type="hidden" name="grupo" value={chave} />
                <input type="hidden" name={`ids_${chave}`} value={cs.map((c) => c.id).join(",")} />
                <p className="legenda">{cs.map((c) => `${c.numero} (${c.orgao})`).join(" · ")}</p>
                <div className="radios-cartao">
                  {convs.map((c) => (
                    <label key={c.id} className="radio-cartao">
                      <input type="radio" name={`conv_${chave}`} value={c.id} defaultChecked={c.id === sugerida?.id} />
                      <span>
                        <strong>{c.nome}</strong>
                        <span className="desc">Data-base em {MESES[c.mesDataBase - 1]}{c === sugerida ? " · sugerida pela cidade" : ""}</span>
                      </span>
                    </label>
                  ))}
                  <label className="radio-cartao">
                    <input type="radio" name={`conv_${chave}`} value="nova" defaultChecked={!sugerida} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>Cadastrar a convenção</strong>
                      <span className="desc">Confirme o nome e escolha o mês da data-base.</span>
                      <span className="mt-16" style={{ display: "block" }}>
                        <CampoTexto nome={`nome_${chave}`} rotulo="Nome" valorInicial={`Convenção de asseio e conservação de ${g} ${anoAtual}`} />
                        <span className="linha-form">
                          <SelectMes nome={`mes_${chave}`} rotulo="Mês da data-base" />
                          <CampoInteiro nome={`ano_${chave}`} rotulo="Ano" valorInicial={anoAtual} />
                        </span>
                      </span>
                    </span>
                  </label>
                  <label className="radio-cartao">
                    <input type="radio" name={`conv_${chave}`} value="naosei" />
                    <span>
                      <strong>Não sei</strong>
                      <span className="desc">Criamos a tarefa &ldquo;Descobrir a convenção&rdquo; na tela Hoje.</span>
                    </span>
                  </label>
                </div>
                <input type="hidden" name={`uf_${chave}`} value={uf === "--" ? "" : uf} />
                <input type="hidden" name={`cidade_${chave}`} value={cidade === "Cidade não informada" ? "" : cidade} />
              </fieldset>
            );
          })}
        </div>
        <div className="rodape-assistente">
          <Link href="/app/boas-vindas?passo=contratos" className="btn">
            Voltar
          </Link>
          <BotaoEnvio>Continuar</BotaoEnvio>
        </div>
      </FormAcao>
    </div>
  );
}

async function Pronto() {
  const ctx = await contexto();
  const contratos = await contratosDoContexto(ctx);
  const hoje = hojeUTC();
  const k = contratos.flatMap((c) => prazosDoContrato(c, hoje)).filter((p) => diasAte(p.data) >= 0 && diasAte(p.data) <= 183).length;
  return (
    <div className="cartao pico">
      <CheckCircle2 size={32} strokeWidth={1.5} aria-hidden style={{ color: "var(--verde)" }} />
      <h1 className="mt-16">
        Sua carteira tem {plural(contratos.length, "contrato", "contratos")} e {plural(k, "prazo", "prazos")} nos próximos 6 meses.
      </h1>
      <p className="secundario">A tela Hoje mostra o que fazer primeiro. Os avisos chegam aos 60, 30 e 7 dias de cada prazo.</p>
      <div className="fileira">
        <Link href="/app/hoje" className="btn btn-primario">
          Ver o que fazer hoje
        </Link>
        <Link href="/app/carteira" className="btn">
          Ver a carteira
        </Link>
      </div>
      {contratos.some((c) => c.maoDeObraDedicada && !c.convencao) && (
        <Alerta tipo="atencao" className="mt-16">
          Alguns contratos estão sem convenção. Sem ela, não dá para avisar a data-base.
        </Alerta>
      )}
    </div>
  );
}
