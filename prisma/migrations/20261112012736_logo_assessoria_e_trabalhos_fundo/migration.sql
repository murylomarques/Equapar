-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "marcaLogo" TEXT;

-- CreateTable
CREATE TABLE "TrabalhoFundo" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "caminho" TEXT,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "vistoEm" TIMESTAMP(3),

    CONSTRAINT "TrabalhoFundo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrabalhoFundo_usuarioId_criadoEm_idx" ON "TrabalhoFundo"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "TrabalhoFundo" ADD CONSTRAINT "TrabalhoFundo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
