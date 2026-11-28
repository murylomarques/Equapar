-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "jornadaAlteracaoCustos" TIMESTAMP(3),
ADD COLUMN     "jornadaAssinaturaContrato" TIMESTAMP(3),
ADD COLUMN     "jornadaEfeitosReconhecidos" TIMESTAMP(3),
ADD COLUMN     "jornadaEnquadramento" TEXT,
ADD COLUMN     "metodologiaVersao" TEXT;

