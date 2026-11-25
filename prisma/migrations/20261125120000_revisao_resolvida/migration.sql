-- Revisão de fatura tratada pela equipe (painel interno). Só acrescenta colunas.
ALTER TABLE "Fatura" ADD COLUMN "revisaoResolvidaEm" TIMESTAMP(3),
ADD COLUMN "revisaoResolvidaPor" TEXT;
