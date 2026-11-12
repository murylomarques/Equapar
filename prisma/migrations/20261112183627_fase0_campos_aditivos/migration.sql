-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "demoExpiraEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "vigenciaFimPncp" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "hashCalculo" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigosRecuperacao" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "emailVerificadoEm" TIMESTAMP(3),
ADD COLUMN     "totpSegredoPendente" TEXT;

-- CreateTable
CREATE TABLE "TentativaAcesso" (
    "chave" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "janelaAte" TIMESTAMP(3) NOT NULL,
    "bloqueadoAte" TIMESTAMP(3),

    CONSTRAINT "TentativaAcesso_pkey" PRIMARY KEY ("chave")
);
