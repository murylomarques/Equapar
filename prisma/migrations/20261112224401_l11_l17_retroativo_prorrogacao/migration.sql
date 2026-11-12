-- CreateEnum
CREATE TYPE "RetroContarAte" AS ENUM ('DATA_INFORMADA', 'DATA_PROTOCOLO', 'DATA_APOSTILAMENTO');

-- CreateEnum
CREATE TYPE "RetroMesIncompleto" AS ENUM ('DIAS_CORRIDOS', 'MES_30_DIAS');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "retroContarAte" "RetroContarAte" NOT NULL DEFAULT 'DATA_INFORMADA',
ADD COLUMN     "retroMesIncompleto" "RetroMesIncompleto" NOT NULL DEFAULT 'DIAS_CORRIDOS';

-- CreateTable
CREATE TABLE "Prorrogacao" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "dataTermo" TIMESTAMP(3) NOT NULL,
    "novoFim" TIMESTAMP(3) NOT NULL,
    "comRessalva" BOOLEAN NOT NULL DEFAULT false,
    "textoRessalva" TEXT,
    "registradoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prorrogacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prorrogacao_contratoId_idx" ON "Prorrogacao"("contratoId");

-- AddForeignKey
ALTER TABLE "Prorrogacao" ADD CONSTRAINT "Prorrogacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
