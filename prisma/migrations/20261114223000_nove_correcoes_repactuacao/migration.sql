-- Migração aditiva: preserva os campos legados e acrescenta rastreabilidade,
-- snapshots de memória, decisão parcial, faturamento e baixas parciais.
ALTER TABLE "Contrato"
  ADD COLUMN "vigenciaFimOrigem" TEXT,
  ADD COLUMN "prorrogacaoPrevistaEm" TIMESTAMP(3),
  ADD COLUMN "prorrogacaoPrevistaOrigem" TEXT,
  ADD COLUMN "prorrogacaoAssinadaEm" TIMESTAMP(3),
  ADD COLUMN "prorrogacaoAssinadaOrigem" TEXT;

UPDATE "Contrato"
SET "vigenciaFimOrigem" = CASE
  WHEN "vigenciaFimPncp" IS NOT NULL AND "vigenciaFimPncp" = "vigenciaFim" THEN 'PNCP'
  ELSE 'LEGADO_DESCONHECIDO'
END;

ALTER TABLE "Pedido"
  ADD COLUMN "regraArredondamento" TEXT NOT NULL DEFAULT 'DECIMAL_2_CASAS_MEIO_PARA_CIMA_POR_LINHA',
  ADD COLUMN "retroativoCompetencias" JSONB,
  ADD COLUMN "calculoManual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calculoManualJustificativa" TEXT,
  ADD COLUMN "memoriaVersaoAtual" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "memoriaVersaoAprovadaId" TEXT,
  ADD COLUMN "documentacaoCompletaEm" TIMESTAMP(3),
  ADD COLUMN "documentacaoCompletaOrigem" TEXT,
  ADD COLUMN "decisaoTipo" TEXT,
  ADD COLUMN "decisaoEvidencia" TEXT,
  ADD COLUMN "mensalSolicitado" DECIMAL(14,2),
  ADD COLUMN "mensalAprovado" DECIMAL(14,2),
  ADD COLUMN "mensalVigenteAnterior" DECIMAL(14,2),
  ADD COLUMN "retroativoAprovado" DECIMAL(14,2),
  ADD COLUMN "conciliacaoPendente" BOOLEAN NOT NULL DEFAULT false;

-- O campo legado valorDeferido representava o retroativo reconhecido.
-- Não inferimos mensal aprovado nem evidência: esses registros ficam sinalizados.
UPDATE "Pedido"
SET "retroativoAprovado" = "valorDeferido",
    "decisaoTipo" = CASE WHEN "estado" = 'INDEFERIDO' THEN 'INDEFERIDO' ELSE 'LEGADO_A_CONCILIAR' END,
    "conciliacaoPendente" = true
WHERE "valorDeferido" IS NOT NULL OR "estado" IN ('DEFERIDO', 'FATURADO', 'RECEBIDO');

CREATE TABLE "MemoriaVersao" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "hash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "aprovadoPorId" TEXT,
  "aprovadoPorNome" TEXT,
  "aprovadoEm" TIMESTAMP(3),
  "protocoladoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoriaVersao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemoriaVersao_pedidoId_numero_key" ON "MemoriaVersao"("pedidoId", "numero");
CREATE UNIQUE INDEX "MemoriaVersao_pedidoId_hash_key" ON "MemoriaVersao"("pedidoId", "hash");

CREATE TABLE "NotaFiscalPedido" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "identificacao" TEXT NOT NULL,
  "emitidaEm" TIMESTAMP(3) NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "referenciaOperacao" TEXT NOT NULL,
  "evidencia" TEXT,
  "canceladaEm" TIMESTAMP(3),
  "criadoPor" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotaFiscalPedido_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotaFiscalPedido_pedidoId_identificacao_key" ON "NotaFiscalPedido"("pedidoId", "identificacao");
CREATE UNIQUE INDEX "NotaFiscalPedido_pedidoId_referenciaOperacao_key" ON "NotaFiscalPedido"("pedidoId", "referenciaOperacao");
CREATE INDEX "NotaFiscalPedido_pedidoId_emitidaEm_idx" ON "NotaFiscalPedido"("pedidoId", "emitidaEm");

CREATE TABLE "BaixaPedido" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "notaFiscalId" TEXT NOT NULL,
  "recebidoEm" TIMESTAMP(3) NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "referenciaOperacao" TEXT NOT NULL,
  "autorId" TEXT,
  "autorNome" TEXT,
  "canceladaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BaixaPedido_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BaixaPedido_pedidoId_referenciaOperacao_key" ON "BaixaPedido"("pedidoId", "referenciaOperacao");
CREATE INDEX "BaixaPedido_notaFiscalId_recebidoEm_idx" ON "BaixaPedido"("notaFiscalId", "recebidoEm");

CREATE TABLE "ValorMensalContrato" (
  "id" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "pedidoId" TEXT,
  "valorAnterior" DECIMAL(14,2),
  "valorNovo" DECIMAL(14,2) NOT NULL,
  "ato" TEXT NOT NULL,
  "evidencia" TEXT,
  "aplicavelEm" TIMESTAMP(3) NOT NULL,
  "registradoPor" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValorMensalContrato_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ValorMensalContrato_contratoId_aplicavelEm_idx" ON "ValorMensalContrato"("contratoId", "aplicavelEm");

ALTER TABLE "Documento" ADD COLUMN "memoriaVersaoId" TEXT;
ALTER TABLE "MemoriaVersao" ADD CONSTRAINT "MemoriaVersao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoriaVersao" ADD CONSTRAINT "MemoriaVersao_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_memoriaVersaoId_fkey" FOREIGN KEY ("memoriaVersaoId") REFERENCES "MemoriaVersao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotaFiscalPedido" ADD CONSTRAINT "NotaFiscalPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BaixaPedido" ADD CONSTRAINT "BaixaPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BaixaPedido" ADD CONSTRAINT "BaixaPedido_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaixaPedido" ADD CONSTRAINT "BaixaPedido_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValorMensalContrato" ADD CONSTRAINT "ValorMensalContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
