-- AlterEnum
ALTER TYPE "Gatilho" ADD VALUE 'JORNADA_EC141';

-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "avisoJornadaEm" TIMESTAMP(3),
ADD COLUMN     "dicasDispensadas" JSONB,
ADD COLUMN     "pesquisaDispensadaEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "cenarioJornada" TEXT,
ADD COLUMN     "horasCobertura" DECIMAL(6,2),
ADD COLUMN     "inicioJornada" TIMESTAMP(3),
ADD COLUMN     "jornadaAntes" INTEGER,
ADD COLUMN     "jornadaDepois" INTEGER,
ADD COLUMN     "pedidoOrigemId" TEXT,
ADD COLUMN     "recursoData" TIMESTAMP(3),
ADD COLUMN     "recursoPrazo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RegistroTempo" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "registradoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroTempo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaPesquisa" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespostaPesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricaMensal" (
    "mes" TEXT NOT NULL,
    "custoAquisicao" DECIMAL(12,2),
    "margemPct" DECIMAL(5,2),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricaMensal_pkey" PRIMARY KEY ("mes")
);

-- CreateIndex
CREATE INDEX "RegistroTempo_contaId_data_idx" ON "RegistroTempo"("contaId", "data");

-- AddForeignKey
ALTER TABLE "RegistroTempo" ADD CONSTRAINT "RegistroTempo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaPesquisa" ADD CONSTRAINT "RespostaPesquisa_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

