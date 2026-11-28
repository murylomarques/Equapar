/**
 * B1 (parecer de 28/11/2026, com a opção escolhida pelo dono): o que se devolve quando o cliente cancela.
 *
 *  - Garantia: na 1ª assinatura (Carteira ou Assessoria), até 30 dias corridos do pagamento, devolve tudo o que foi pago
 *    nela e o acesso pago termina na hora. O Piloto é um projeto, não uma assinatura: fica fora da garantia.
 *  - Anual, fora da garantia: devolve o valor pago menos os meses iniciados, cada um pelo preço do plano mensal na tabela
 *    da contratação. Sem multa. O acesso pago termina na hora. Se o resultado não for positivo, nada a devolver e o
 *    acesso segue até o fim do período.
 *  - Mensal, fora da garantia: nada a devolver; o acesso segue até o fim do mês pago.
 *
 * Pura: o servidor chama com a fatura do período em andamento.
 */
import Decimal from "decimal.js";
import { PRECOS } from "./precos";

export type FaturaParaReembolso = {
  valor: Decimal.Value;
  valorEstornado?: Decimal.Value | null;
  ciclo: string | null;
  periodoInicio: Date;
  pagaEm: Date | null;
};

export type Reembolso = {
  tipo: "GARANTIA" | "PROPORCIONAL_ANUAL" | "NENHUM";
  /** valor a devolver; "0.00" quando nada */
  valor: string;
  /** o acesso pago termina no cancelamento (true) ou segue até o fim do período (false) */
  encerraAgora: boolean;
  /** meses iniciados descontados (só no anual) */
  mesesUsados: number;
  /** explicação curta para a tela e o e-mail */
  explicacao: string;
};

const DIA = 86_400_000;
export const reaisBr = (v: Decimal.Value) =>
  `R$ ${new Decimal(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** Meses iniciados desde o início do período: o mês em curso conta inteiro (máximo 12). */
export function mesesIniciados(inicio: Date, agora: Date): number {
  let n = 0;
  while (somarMeses(inicio, n) < agora && n < 12) n++;
  return n;
}

/** Mesmo dia n meses depois (dia 31 vira o último dia do mês), sempre contado do início para não acumular desvio. */
function somarMeses(inicio: Date, n: number): Date {
  const y = inicio.getUTCFullYear();
  const m = inicio.getUTCMonth() + n;
  const ultimoDia = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(inicio.getUTCDate(), ultimoDia), inicio.getUTCHours(), inicio.getUTCMinutes(), inicio.getUTCSeconds()));
}

export function dentroDaGarantia(pagaEm: Date | null, inicio: Date, agora: Date): boolean {
  const desde = pagaEm ?? inicio;
  return agora.getTime() - desde.getTime() <= PRECOS.garantiaDias * DIA;
}

export function calcularReembolso(f: FaturaParaReembolso, o: { primeiraAssinatura: boolean; mensalCheio: Decimal.Value; agora: Date }): Reembolso {
  const pago = Decimal.max(0, new Decimal(f.valor).minus(f.valorEstornado ?? 0));
  if (o.primeiraAssinatura && pago.gt(0) && dentroDaGarantia(f.pagaEm, f.periodoInicio, o.agora))
    return {
      tipo: "GARANTIA",
      valor: pago.toFixed(2),
      encerraAgora: true,
      mesesUsados: 0,
      explicacao: `Garantia de ${PRECOS.garantiaDias} dias: devolvemos os ${reaisBr(pago)} pagos e o acesso pago termina agora.`,
    };
  if (f.ciclo === "ANUAL") {
    const meses = mesesIniciados(f.periodoInicio, o.agora);
    const devolver = pago.minus(new Decimal(o.mensalCheio).times(meses)).toDecimalPlaces(2);
    if (devolver.gt(0))
      return {
        tipo: "PROPORCIONAL_ANUAL",
        valor: devolver.toFixed(2),
        encerraAgora: true,
        mesesUsados: meses,
        explicacao: `Plano anual: dos ${reaisBr(pago)} pagos, descontamos ${meses} ${meses === 1 ? "mês iniciado" : "meses iniciados"} a ${reaisBr(o.mensalCheio)} (preço do plano mensal) e devolvemos ${reaisBr(devolver)}. O acesso pago termina agora.`,
      };
    return {
      tipo: "NENHUM",
      valor: "0.00",
      encerraAgora: false,
      mesesUsados: meses,
      explicacao: "Os meses já iniciados, pelo preço do plano mensal, cobrem o que foi pago: não há devolução e o acesso segue até o fim do período.",
    };
  }
  return { tipo: "NENHUM", valor: "0.00", encerraAgora: false, mesesUsados: 0, explicacao: "O acesso segue até o fim do mês pago e nada mais é cobrado." };
}
