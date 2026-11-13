-- C6 e D4 (v4): colunas novas anuláveis ou com padrão; nada apagado, renomeado ou com tipo trocado
-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "jornadaDataAditivo" TIMESTAMP(3),
ADD COLUMN     "jornadaInicioEfeitos" TIMESTAMP(3),
ADD COLUMN     "retroCompararMes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimaCompetenciaPaga" TEXT,
ADD COLUMN     "valoresJaPagos" DECIMAL(14,2) DEFAULT 0;
