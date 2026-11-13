/**
 * S7. Dados fictícios da DEMONSTRAÇÃO (pode rodar em produção): a conta modelo que cada visitante copia
 * (C6.2) e a demonstração compartilhada só leitura. NÃO cria usuário Dono e não imprime senha.
 *
 *   npm run db:seed:demo        (tsx --env-file=.env prisma/seed-demo.ts)
 *
 * Para desenvolvimento, use `npm run db:seed` (seed-dev), que chama este e cria o Dono de teste.
 * Empresas, órgãos, CNPJs e pessoas daqui são fictícios.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { compararPlanilhas, calcularRetroativo } from "../src/lib/calculo/motor";
import type { LinhaPlanilha, PlanilhaCustos } from "../src/lib/calculo/tipos";

const dbPadrao = new PrismaClient();
const EMAIL_DEMO = "demonstracao@equapar.local";
const EMAIL_DEMO_ASSESSORIA = "demonstracao-assessoria@equapar.local";

function cnpjFicticio() {
  const base = Array.from({ length: 12 }, (_, i) => (i < 8 ? Math.floor(Math.random() * 10) : [0, 0, 0, 1][i - 8]));
  const dv = (nums: number[]) => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = nums.reduce((s, n, i) => s + n * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

const dia = (offset: number) => {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return new Date(u.getTime() + offset * 86_400_000);
};

function posto(id: string, nome: string, qtd: number, salario: string, vt: string, va: string, insal: string): PlanilhaCustos["tipos"][number] {
  const L = (l: LinhaPlanilha) => l;
  return {
    id,
    nome,
    quantidade: qtd,
    linhas: [
      L({ id: `${id}-sal`, modulo: "M1", descricao: "Salário base", tipo: "VALOR", valor: salario, salarioBase: true, fonte: "CCT exemplo, cláusula 4ª" }),
      L({ id: `${id}-ins`, modulo: "M1", descricao: "Adicional de insalubridade", tipo: "VALOR", valor: insal, fonte: "CCT exemplo, cláusula 12ª" }),
      L({ id: `${id}-13`, modulo: "M2_1", descricao: "13º salário", tipo: "PERCENTUAL", base: "M1", valor: "8.33" }),
      L({ id: `${id}-fer`, modulo: "M2_1", descricao: "Férias e adicional de férias", tipo: "PERCENTUAL", base: "M1", valor: "12.10" }),
      L({ id: `${id}-inss`, modulo: "M2_2", descricao: "INSS", tipo: "PERCENTUAL", base: "M1_M21", valor: "20" }),
      L({ id: `${id}-se`, modulo: "M2_2", descricao: "Salário-educação", tipo: "PERCENTUAL", base: "M1_M21", valor: "2.5" }),
      L({ id: `${id}-sat`, modulo: "M2_2", descricao: "SAT/RAT ajustado", tipo: "PERCENTUAL", base: "M1_M21", valor: "3" }),
      L({ id: `${id}-sesc`, modulo: "M2_2", descricao: "SESC", tipo: "PERCENTUAL", base: "M1_M21", valor: "1.5" }),
      L({ id: `${id}-senac`, modulo: "M2_2", descricao: "SENAC", tipo: "PERCENTUAL", base: "M1_M21", valor: "1" }),
      L({ id: `${id}-sebrae`, modulo: "M2_2", descricao: "SEBRAE", tipo: "PERCENTUAL", base: "M1_M21", valor: "0.6" }),
      L({ id: `${id}-incra`, modulo: "M2_2", descricao: "INCRA", tipo: "PERCENTUAL", base: "M1_M21", valor: "0.2" }),
      L({ id: `${id}-fgts`, modulo: "M2_2", descricao: "FGTS", tipo: "PERCENTUAL", base: "M1_M21", valor: "8" }),
      L({ id: `${id}-vt`, modulo: "M2_3", descricao: "Vale-transporte", tipo: "VALOR", valor: vt, fonte: "CCT exemplo, cláusula 15ª" }),
      L({ id: `${id}-dvt`, modulo: "M2_3", descricao: "Desconto do vale-transporte", tipo: "PERCENTUAL", base: "SALARIO_BASE", valor: "-6" }),
      L({ id: `${id}-va`, modulo: "M2_3", descricao: "Auxílio-alimentação", tipo: "VALOR", valor: va, fonte: "CCT exemplo, cláusula 16ª" }),
      L({ id: `${id}-avi`, modulo: "M3", descricao: "Aviso prévio indenizado", tipo: "PERCENTUAL", base: "M1", valor: "0.42" }),
      L({ id: `${id}-avt`, modulo: "M3", descricao: "Aviso prévio trabalhado", tipo: "PERCENTUAL", base: "M1", valor: "1.94" }),
      L({ id: `${id}-mfgts`, modulo: "M3", descricao: "Multa do FGTS na rescisão", tipo: "PERCENTUAL", base: "M1", valor: "4" }),
      L({ id: `${id}-aus`, modulo: "M4", descricao: "Substituto nas ausências legais", tipo: "PERCENTUAL", base: "M1_M3", valor: "1.5" }),
      L({ id: `${id}-uni`, modulo: "M5", descricao: "Uniformes", tipo: "VALOR", valor: "25.00" }),
      L({ id: `${id}-ci`, modulo: "M6_CI", descricao: "Custos indiretos", tipo: "PERCENTUAL", base: "SUBTOTAL", valor: "3" }),
      L({ id: `${id}-luc`, modulo: "M6_LUCRO", descricao: "Lucro", tipo: "PERCENTUAL", base: "SUBTOTAL_CI", valor: "5" }),
      L({ id: `${id}-pis`, modulo: "M6_TRIBUTOS", descricao: "PIS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "1.65" }),
      L({ id: `${id}-cof`, modulo: "M6_TRIBUTOS", descricao: "COFINS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "7.6" }),
      L({ id: `${id}-iss`, modulo: "M6_TRIBUTOS", descricao: "ISS", tipo: "PERCENTUAL", base: "POR_DENTRO", valor: "5" }),
    ],
  };
}

export const antes: PlanilhaCustos = { tipos: [posto("srv", "Servente 44h", 10, "1740.00", "220.00", "440.00", "303.60"), posto("enc", "Encarregado 44h", 1, "2400.00", "220.00", "440.00", "303.60")] };
export const agora: PlanilhaCustos = { tipos: [posto("srv", "Servente 44h", 10, "1820.00", "240.00", "480.00", "324.20"), posto("enc", "Encarregado 44h", 1, "2510.00", "240.00", "480.00", "324.20")] };
const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Recria a conta modelo fictícia (apaga só a conta modelo anterior, a do usuário da demonstração). */
export async function criarModeloDemo(db: PrismaClient = dbPadrao) {
  const antigos = await db.usuario.findMany({ where: { email: EMAIL_DEMO }, include: { membros: true } });
  for (const u of antigos) for (const m of u.membros) await db.conta.deleteMany({ where: { id: m.contaId, demo: false } });
  await db.usuario.deleteMany({ where: { email: EMAIL_DEMO } });

  const conta = await db.conta.create({ data: { nome: "Empresa Exemplo Limpeza e Conservação (fictícia)", tipo: "EMPRESA", plano: "CARTEIRA" } });
  const demo = await db.usuario.create({ data: { nome: "Juliana (exemplo)", email: EMAIL_DEMO, senhaHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12) } });
  await db.membro.create({ data: { usuarioId: demo.id, contaId: conta.id, papel: "LEITURA" } });
  const empresa = await db.empresa.create({ data: { contaId: conta.id, cnpj: cnpjFicticio(), razaoSocial: "Empresa Exemplo Limpeza e Conservação Ltda. (fictícia)", exemplo: true } });
  const ano = new Date().getUTCFullYear();
  const conv = await db.convencao.create({
    data: {
      contaId: conta.id,
      nome: `CCT Asseio e Conservação Exemplo/ES ${ano} (fictícia)`,
      sindicatos: "Sindicato patronal exemplo e sindicato laboral exemplo",
      cidade: "Cidade Exemplo",
      uf: "ES",
      ano,
      mesDataBase: 1,
      situacao: "REGISTRADA",
      dataDeposito: new Date(Date.UTC(ano, 1, 10)),
      registroMte: "ES000000/EXEMPLO",
    },
  });
  const dataBase = new Date(Date.UTC(ano, 0, 1));
  const comp = compararPlanilhas(antes, agora);
  const mk = (d: Partial<Prisma.ContratoUncheckedCreateInput> & Pick<Prisma.ContratoUncheckedCreateInput, "numero" | "orgao" | "objeto" | "vigenciaInicio" | "vigenciaFim">) =>
    db.contrato.create({ data: { empresaId: empresa.id, uf: "ES", municipio: "Cidade Exemplo", esfera: "M", maoDeObraDedicada: true, convencaoId: conv.id, postos: 11, valorMensal: comp.mensalAntes, ...d } });

  // Valores mensais variados (fictícios). 12/2024 e 07/2025 seguem a planilha dos pedidos de exemplo.
  // 1. Prorrogação em 18 dias, convenção nova depositada, nenhum pedido: "Pedir repactuação"
  await mk({ numero: "45/2025", orgao: "Prefeitura Municipal de Exemplo", objeto: "Serviços contínuos de limpeza e conservação predial com dedicação exclusiva de mão de obra (exemplo)", vigenciaInicio: dia(-347), vigenciaFim: dia(18), dataProposta: new Date(Date.UTC(ano - 1, 1, 20)) });

  // 2. Pedido protocolado há 21 dias
  const c2 = await mk({ numero: "12/2024", orgao: "Tribunal Regional Exemplo", esfera: "F", objeto: "Limpeza, asseio e conservação das unidades do tribunal (exemplo)", vigenciaInicio: dia(-500), vigenciaFim: dia(140), dataProposta: new Date(Date.UTC(ano - 2, 9, 1)) });
  const retro2 = calcularRetroativo(comp.diferencaMensal, dataBase, dia(-21));
  await db.pedido.create({
    data: {
      contratoId: c2.id, estado: "PROTOCOLADO", passoAtual: 5, convencaoId: conv.id, dataBase, dataDeposito: conv.dataDeposito, planilhaAntes: json(antes), planilhaAgora: json(agora),
      dataReferencia: dia(-21), diferencaMensal: comp.diferencaMensal, diferencaRetroativa: retro2.total, memoriaAprovadaEm: dia(-23), memoriaAprovadaPor: "Marcos (exemplo)",
      geradoEm: dia(-22), protocoloNumero: "EXEMPLO-0001/2026", protocoloData: dia(-21), checklist: json({ convencao_nova: "ANEXADO", planilha_atual: "ANEXADO" }),
    },
  });

  // 3. Pedido deferido e apostilado, falta faturar: A receber
  const c3 = await mk({ numero: "07/2025", orgao: "Universidade Federal Exemplo", esfera: "F", objeto: "Serviços de limpeza e conservação nos campi (exemplo)", vigenciaInicio: dia(-300), vigenciaFim: dia(260), dataProposta: new Date(Date.UTC(ano - 1, 0, 5)), valorMensal: comp.mensalAgora, ultimoApostilamento: dia(-12) });
  await db.pedido.create({
    data: {
      contratoId: c3.id, estado: "DEFERIDO", passoAtual: 5, convencaoId: conv.id, dataBase, planilhaAntes: json(antes), planilhaAgora: json(agora), dataReferencia: dia(-60),
      diferencaMensal: comp.diferencaMensal, diferencaRetroativa: "31540.20", memoriaAprovadaEm: dia(-80), memoriaAprovadaPor: "Marcos (exemplo)", geradoEm: dia(-79),
      protocoloNumero: "EXEMPLO-0002/2026", protocoloData: dia(-78), respostaData: dia(-40), deferidoEm: dia(-40), valorDeferido: "31540.20", apostiladoEm: dia(-12),
    },
  });

  // 4. Reajuste por índice
  await mk({ numero: "03/2025", orgao: "Hospital Exemplo", objeto: "Manutenção predial preventiva e corretiva (exemplo)", vigenciaInicio: dia(-160), vigenciaFim: dia(205), tipoReajuste: "INDICE", maoDeObraDedicada: false, convencaoId: null, postos: null, valorMensal: "27410.00", clausulaReajuste: "Cláusula 9ª (exemplo): o preço será reajustado anualmente pelo IPCA, contado da data da proposta." });

  // 5. Sem convenção informada
  const c5 = await mk({ numero: "19/2025", orgao: "Instituto Federal Exemplo", esfera: "F", municipio: "Outra Cidade Exemplo", objeto: "Serviços de copeiragem e recepção com dedicação exclusiva (exemplo)", vigenciaInicio: dia(-90), vigenciaFim: dia(275), convencaoId: null, postos: 4, valorMensal: "21876.40" });
  await db.tarefa.create({ data: { contaId: conta.id, contratoId: c5.id, titulo: "Descobrir a convenção" } });

  await db.historico.create({ data: { contaId: conta.id, acao: "Dados de exemplo criados (fictícios)" } });

  console.log("Dados fictícios da demonstração criados (conta modelo, sem usuário Dono).");
  return { contaId: conta.id };
}

/**
 * 5.2: conta modelo de ASSESSORIA com três clientes fictícios, para a demonstração da página "Para assessorias".
 * Apaga só a conta modelo de assessoria anterior. Ninguém entra nela: cada visitante recebe uma cópia.
 */
export async function criarModeloAssessoriaDemo(db: PrismaClient = dbPadrao) {
  const antigos = await db.usuario.findMany({ where: { email: EMAIL_DEMO_ASSESSORIA }, include: { membros: true } });
  for (const u of antigos) for (const m of u.membros) await db.conta.deleteMany({ where: { id: m.contaId, demo: false } });
  await db.usuario.deleteMany({ where: { email: EMAIL_DEMO_ASSESSORIA } });

  const conta = await db.conta.create({ data: { nome: "Assessoria Exemplo (fictícia)", tipo: "ASSESSORIA", plano: "ASSESSORIA", marcaNome: "Assessoria Exemplo", marcaCor: "#1f5f4a" } });
  const u = await db.usuario.create({ data: { nome: "Carla (exemplo)", email: EMAIL_DEMO_ASSESSORIA, senhaHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12) } });
  await db.membro.create({ data: { usuarioId: u.id, contaId: conta.id, papel: "LEITURA" } });
  const ano = new Date().getUTCFullYear();
  const conv = await db.convencao.create({
    data: { contaId: conta.id, nome: `CCT Asseio e Conservação Exemplo/ES ${ano} (fictícia)`, cidade: "Cidade Exemplo", uf: "ES", ano, mesDataBase: 1, situacao: "REGISTRADA", dataDeposito: new Date(Date.UTC(ano, 1, 10)), registroMte: "ES000000/EXEMPLO" },
  });
  const dataBase = new Date(Date.UTC(ano, 0, 1));
  const comp = compararPlanilhas(antes, agora);
  const clientes = [
    { nome: "Limpeza Alfa Ltda. (fictícia)", contratos: [
      { numero: "21/2025", orgao: "Prefeitura Municipal de Exemplo", fim: 25, pedido: null },
      { numero: "08/2024", orgao: "Câmara Municipal de Exemplo", fim: 190, pedido: "PROTOCOLADO" },
    ] },
    { nome: "Conservação Beta Ltda. (fictícia)", contratos: [
      { numero: "33/2025", orgao: "Universidade Federal Exemplo", fim: 48, pedido: null },
      { numero: "02/2025", orgao: "Tribunal Regional Exemplo", fim: 300, pedido: "DEFERIDO" },
    ] },
    { nome: "Serviços Gama Ltda. (fictícia)", contratos: [{ numero: "14/2025", orgao: "Instituto Federal Exemplo", fim: 220, pedido: null }] },
  ];
  for (const cl of clientes) {
    const e = await db.empresa.create({ data: { contaId: conta.id, cnpj: cnpjFicticio(), razaoSocial: cl.nome, exemplo: true } });
    for (const k of cl.contratos) {
      const c = await db.contrato.create({
        data: {
          empresaId: e.id, numero: k.numero, orgao: k.orgao, objeto: "Serviços contínuos de limpeza e conservação com dedicação exclusiva de mão de obra (exemplo)",
          uf: "ES", municipio: "Cidade Exemplo", esfera: "M", maoDeObraDedicada: true, convencaoId: conv.id, postos: 11, valorMensal: comp.mensalAntes,
          vigenciaInicio: dia(k.fim - 365), vigenciaFim: dia(k.fim), dataProposta: new Date(Date.UTC(ano - 1, 1, 20)),
        },
      });
      if (k.pedido === "PROTOCOLADO")
        await db.pedido.create({
          data: { contratoId: c.id, estado: "PROTOCOLADO", passoAtual: 5, convencaoId: conv.id, dataBase, planilhaAntes: json(antes), planilhaAgora: json(agora), dataReferencia: dia(-15), diferencaMensal: comp.diferencaMensal, diferencaRetroativa: calcularRetroativo(comp.diferencaMensal, dataBase, dia(-15)).total, memoriaAprovadaEm: dia(-17), memoriaAprovadaPor: "Carla (exemplo)", geradoEm: dia(-16), protocoloNumero: "EXEMPLO-0101/2026", protocoloData: dia(-15) },
        });
      if (k.pedido === "DEFERIDO")
        await db.pedido.create({
          data: { contratoId: c.id, estado: "DEFERIDO", passoAtual: 5, convencaoId: conv.id, dataBase, planilhaAntes: json(antes), planilhaAgora: json(agora), dataReferencia: dia(-70), diferencaMensal: comp.diferencaMensal, diferencaRetroativa: "29870.40", memoriaAprovadaEm: dia(-90), memoriaAprovadaPor: "Carla (exemplo)", geradoEm: dia(-89), protocoloNumero: "EXEMPLO-0102/2026", protocoloData: dia(-88), respostaData: dia(-50), deferidoEm: dia(-50), valorDeferido: "29870.40" },
        });
    }
  }
  console.log("Dados fictícios da demonstração de assessoria criados (3 clientes).");
  return { contaId: conta.id };
}

// Rodando direto (npm run db:seed:demo)
if (process.argv[1]?.replaceAll("\\", "/").endsWith("prisma/seed-demo.ts")) {
  criarModeloDemo()
    .then(() => criarModeloAssessoriaDemo())
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => dbPadrao.$disconnect());
}
