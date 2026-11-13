-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "carenciaAte" TIMESTAMP(3),
ADD COLUMN     "ciclo" TEXT NOT NULL DEFAULT 'MENSAL',
ADD COLUMN     "gatewayClienteId" TEXT,
ADD COLUMN     "planoPendente" "Plano",
ADD COLUMN     "situacaoCobranca" TEXT NOT NULL DEFAULT 'EM_DIA';

-- AlterTable
ALTER TABLE "Fatura" ADD COLUMN     "gatewayId" TEXT,
ADD COLUMN     "linkPagamento" TEXT,
ADD COLUMN     "metodo" TEXT,
ADD COLUMN     "notaFiscalUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ABERTA',
ADD COLUMN     "tentativas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vencimento" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TarefaFila" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB,
    "chave" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "maxTentativas" INTEGER NOT NULL DEFAULT 5,
    "proximaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "travadaAte" TIMESTAMP(3),
    "travadaPor" TEXT,
    "erro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "TarefaFila_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCobranca" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TarefaFila_chave_key" ON "TarefaFila"("chave");

-- CreateIndex
CREATE INDEX "TarefaFila_status_proximaEm_idx" ON "TarefaFila"("status", "proximaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_gatewayId_key" ON "Fatura"("gatewayId");

