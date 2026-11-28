-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "fundadorAte" TIMESTAMP(3),
ADD COLUMN     "fundadorPlano" "Plano",
ADD COLUMN     "fundadorPrecos" JSONB;

-- AlterTable
ALTER TABLE "Fatura" ADD COLUMN     "oferta" JSONB,
ADD COLUMN     "valorReembolsar" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "termosAceitosEm" TIMESTAMP(3),
ADD COLUMN     "termosVersao" TEXT;

