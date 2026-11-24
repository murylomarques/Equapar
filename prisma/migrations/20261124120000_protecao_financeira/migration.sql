-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "mudancaAgendada" "Plano",
ADD COLUMN     "mudancaAgendadaEm" TIMESTAMP(3),
ADD COLUMN     "planoVigenteAte" TIMESTAMP(3),
ADD COLUMN     "renovacaoCancelada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventoCobranca" ADD COLUMN     "dataEvento" TIMESTAMP(3),
ADD COLUMN     "faturaId" TEXT,
ADD COLUMN     "gatewayId" TEXT,
ADD COLUMN     "resultado" TEXT;

-- AlterTable
ALTER TABLE "Fatura" ADD COLUMN     "canceladaEm" TIMESTAMP(3),
ADD COLUMN     "ciclo" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "periodoFim" TIMESTAMP(3),
ADD COLUMN     "periodoInicio" TIMESTAMP(3),
ADD COLUMN     "plano" "Plano",
ADD COLUMN     "renovacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revisao" TEXT,
ADD COLUMN     "valorEstornado" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UsoIa" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "operacao" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "custoReservadoUsd" DECIMAL(12,6) NOT NULL,
    "custoRealUsd" DECIMAL(12,6),
    "tokensEntrada" INTEGER,
    "tokensSaida" INTEGER,
    "tokensCacheLeitura" INTEGER,
    "tokensCacheEscrita" INTEGER,
    "bytes" INTEGER NOT NULL,
    "paginas" INTEGER,
    "hashDocumento" TEXT,
    "duracaoMs" INTEGER,
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "UsoIa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheIa" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CacheIa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsoIa_periodo_status_idx" ON "UsoIa"("periodo", "status");

-- CreateIndex
CREATE INDEX "UsoIa_contaId_periodo_idx" ON "UsoIa"("contaId", "periodo");

-- CreateIndex
CREATE INDEX "UsoIa_usuarioId_criadoEm_idx" ON "UsoIa"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CacheIa_contaId_chave_key" ON "CacheIa"("contaId", "chave");

-- CreateIndex
CREATE INDEX "Fatura_contaId_status_idx" ON "Fatura"("contaId", "status");


-- Backfill das faturas antigas: o plano e o ciclo vêm da descrição gravada pelo próprio sistema
-- ("Plano carteira (mensal)"); o período pago vem da data do pagamento. Nada é apagado.
UPDATE "Fatura" SET
  "plano" = CASE WHEN "descricao" ILIKE 'Plano carteira%' THEN 'CARTEIRA'::"Plano" WHEN "descricao" ILIKE 'Plano assessoria%' THEN 'ASSESSORIA'::"Plano" ELSE NULL END,
  "ciclo" = CASE WHEN "descricao" ILIKE '%(anual)%' THEN 'ANUAL' WHEN "descricao" ILIKE '%(mensal)%' THEN 'MENSAL' ELSE NULL END
WHERE "plano" IS NULL;

UPDATE "Fatura" SET
  "periodoInicio" = COALESCE("pagaEm", "criadoEm"),
  "periodoFim" = COALESCE("pagaEm", "criadoEm") + CASE WHEN "ciclo" = 'ANUAL' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END
WHERE "status" = 'PAGA' AND "plano" IS NOT NULL AND "periodoInicio" IS NULL;

UPDATE "Conta" c SET "planoVigenteAte" = f.fim
FROM (SELECT "contaId", MAX("periodoFim") AS fim FROM "Fatura" WHERE "status" = 'PAGA' AND "periodoFim" IS NOT NULL GROUP BY "contaId") f
WHERE c."id" = f."contaId" AND c."plano" <> 'GRATIS';
