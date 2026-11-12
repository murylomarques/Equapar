import type { Metadata } from "next";
import Link from "next/link";
import { contexto } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormAcao } from "@/components/form-acao";
import { BotaoEnvio } from "@/components/botao-envio";
import { formatarCnpj } from "@/lib/cnpj";
import { data, diasAte, hojeUTC, MESES } from "@/lib/format";
import { onboardingConvencoes, onboardingImportar, onboardingMarcar } from "../acoes";
import { contratosDoContexto } from "@/lib/consultas";
import { prazosDoContrato } from "@/lib/prazos";

export const metadata: Metadata = { title: "Primeiros passos | Equapar" };

const PASSOS = ["Importar", "Seus contratos", "Convenções", "Pronto"];

export default async function BoasVindas({ searchParams }: { searchParams: Promise<{ passo?: string }> }) {
  const ctx = await contexto();
  const { passo = "importar" } = await searchParams;
  const empresa = ctx.empresaSelecionada ?? ctx.empresas[0];
  const contratos = await db.contrato.findMany({ where: { arquivado: false, empresa: { contaId: ctx.conta.id } }, orderBy: { vigenciaFim: "asc" } });
  const indice = { importar: 0, contratos: 1, convencoes: 2, pronto: 3 }[passo] ?? 0;

  return (
    <div style={{ maxWidth: 860 }}>
      <ol className="progresso" aria-label="Primeiros passos">
        {PASSOS.map((p, i) => (
          <li key={p} className={i < indice ? "feito" : i === indice ? "atual" : undefined} aria-current={i === indice ? "step" : undefined}>
            {i + 1} {p}
          </li>
        ))}
      </ol>
      <div className="passo-conteudo">
        {indice === 0 && <Importar empresa={empresa} temContratos={contratos.length > 0} />}
        {indice === 1 && <Marcar contratos={contratos} />}
        {indice === 2 && <Convencoes />}
        {indice === 3 && <Pronto />}
      </div>
    </div>
  );
}

function Importar({ empresa, temContratos }: { empresa?: { id: string; cnpj: string; razaoSocial: string }; temContratos: boolean }) {
  if (!empresa)
    return (
      <div className="cartao">
        <h1>Adicione o primeiro cliente</h1>
        <p className="secundario">Assessorias começam cadastrando um cliente pelo CNPJ.</p>
        <Link href="/app/clientes" className="btn btn-primario">
          Adicionar cliente
        </Link>
      </div>
    );
  return (
    <div className="cartao">
      <h1>Vamos buscar seus contratos no PNCP</h1>
      <p className="secundario">
        {empresa.razaoSocial} · CNPJ {formatarCnpj(empresa.cnpj)}. A Equapar importa os contratos vigentes publicados no Portal Nacional de Contratações Públicas.
      </p>
      <FormAcao action={onboardingImportar}>
        <input type="hidden" name="empresaId" value={empresa.id} />
        <div className="fileira">
          <BotaoEnvio pendente="Consultando o PNCP…">Importar meus contratos</BotaoEnvio>
          {temContratos && (
            <Link href="/app/boas-vindas?passo=contratos" className="btn">
              Pular: já importei
            </Link>
          )}
          <Link href="/app/contratos/novo" className="btn btn-texto">
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
      <div className="cartao vazio">
        <p>Não achamos contratos vigentes desse CNPJ no PNCP. Contratos antigos podem não ter sido publicados.</p>
        <Link href="/app/contratos/novo" className="btn btn-primario">
          Cadastrar um contrato à mão
        </Link>
      </div>
    );
  return (
    <div className="cartao">
      <h1>Achamos {contratos.length} contratos no PNCP.</h1>
      <p className="secundario">Marque os que têm funcionários seus trabalhando no órgão. Os de limpeza já vêm marcados.</p>
      <FormAcao action={onboardingMarcar}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Contratos com mão de obra dedicada</legend>
          <ul className="lista-limpa pilha-8">
            {contratos.map((c) => (
              <li key={c.id}>
                <label className="check cartao-linha" style={{ display: "flex" }}>
                  <input type="checkbox" name="maoDeObra" value={c.id} defaultChecked={c.maoDeObraDedicada} />
                  <span>
                    <strong>
                      Contrato {c.numero} · {c.orgao}
                    </strong>
                    <span className="legenda" style={{ display: "block" }}>
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
        <p className="secundario">Sem contratos com funcionários dedicados, não há convenção para confirmar.</p>
        <Link href="/app/boas-vindas?passo=pronto" className="btn btn-primario">
          Continuar
        </Link>
      </div>
    );
  return (
    <div className="cartao">
      <h1>Qual convenção coletiva vale para estes contratos?</h1>
      <p className="secundario">Agrupamos por cidade. Use a mesma convenção da planilha de custos da proposta.</p>
      <FormAcao action={onboardingConvencoes}>
        <div className="pilha" style={{ gap: 24 }}>
          {[...grupos.entries()].map(([g, cs], gi) => {
            const chave = `g${gi}`;
            const [cidade, uf] = g.split("/");
            const sugerida = convs.find((c) => c.uf === uf && (!c.cidade || c.cidade === cidade));
            return (
              <fieldset key={g} className="cartao" style={{ padding: 16 }}>
                <legend className="rotulo" style={{ padding: "0 6px" }}>
                  {g} · {cs.length} {cs.length === 1 ? "contrato" : "contratos"}
                </legend>
                <input type="hidden" name="grupo" value={chave} />
                <input type="hidden" name={`ids_${chave}`} value={cs.map((c) => c.id).join(",")} />
                <p className="legenda">{cs.map((c) => `${c.numero} (${c.orgao})`).join(" · ")}</p>
                <div className="pilha-8">
                  {convs.map((c) => (
                    <label key={c.id} className="check">
                      <input type="radio" name={`conv_${chave}`} value={c.id} defaultChecked={c.id === sugerida?.id} />
                      {c.nome} · data-base {MESES[c.mesDataBase - 1]}
                    </label>
                  ))}
                  <label className="check">
                    <input type="radio" name={`conv_${chave}`} value="nova" defaultChecked={!sugerida} />
                    Cadastrar a convenção
                  </label>
                  <div className="linha-form" style={{ paddingLeft: 28 }}>
                    <div className="campo">
                      <label htmlFor={`nome_${chave}`}>Nome</label>
                      <input id={`nome_${chave}`} name={`nome_${chave}`} defaultValue={`Convenção de asseio e conservação de ${g} ${anoAtual}`} />
                    </div>
                    <div className="campo">
                      <label htmlFor={`mes_${chave}`}>Mês da data-base</label>
                      <select id={`mes_${chave}`} name={`mes_${chave}`} defaultValue="">
                        <option value="" disabled>
                          Escolha
                        </option>
                        {MESES.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="campo">
                      <label htmlFor={`ano_${chave}`}>Ano</label>
                      <input id={`ano_${chave}`} name={`ano_${chave}`} type="number" defaultValue={anoAtual} />
                    </div>
                    <input type="hidden" name={`uf_${chave}`} value={uf === "--" ? "" : uf} />
                    <input type="hidden" name={`cidade_${chave}`} value={cidade === "Cidade não informada" ? "" : cidade} />
                  </div>
                  <label className="check">
                    <input type="radio" name={`conv_${chave}`} value="naosei" />
                    Não sei (cria a tarefa &ldquo;Descobrir a convenção&rdquo;)
                  </label>
                </div>
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
    <div className="cartao">
      <h1>
        Sua carteira tem {contratos.length} contratos e {k} prazos nos próximos 6 meses.
      </h1>
      <Link href="/app/carteira" className="btn btn-primario">
        Ver minha carteira
      </Link>
    </div>
  );
}
