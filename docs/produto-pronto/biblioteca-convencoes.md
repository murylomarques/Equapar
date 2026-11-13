# Proposta: biblioteca de convenções (item 5.4.7)

**Situação: proposta, não aplicada.** Depende de decisão do dono (trava 1, migração) e o compartilhamento entre contas depende também do advogado (termos de uso e LGPD), como o item 5.4.6.

## O problema

Hoje cada conta cadastra a própria `Convencao` (nome, sindicatos, data-base, depósito, registro no Mediador). A convenção é um documento público, registrado no Mediador, mas fica presa à conta que a cadastrou. Dez empresas da mesma cidade cadastram a mesma convenção dez vezes.

## O modelo proposto

Separar o documento público do uso que cada conta faz dele.

- `ConvencaoPublica` (nova): o que é público e igual para todos. Registro no Mediador (único), nome, sindicatos, categoria, cidade, UF, ano, mês da data-base, data do depósito.
- `Convencao` (já existe) continua sendo a convenção **da conta**, com uma coluna nova e anulável `publicaId` apontando para a pública. Nada muda no que já existe: contratos e pedidos continuam ligados à `Convencao` da conta, e os cálculos não mudam.
- Os PDFs enviados (cláusulas, etc.) continuam como `Documento` da conta. Nenhum arquivo é compartilhado.

Enquanto o compartilhamento não for decidido, nada é lido de uma conta por outra. A ligação `publicaId` só seria preenchida pela própria conta.

## Migração (aditiva)

```sql
-- CreateTable
CREATE TABLE "ConvencaoPublica" (
    "id" TEXT NOT NULL,
    "registroMte" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sindicatos" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'Asseio e conservação',
    "cidade" TEXT,
    "uf" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mesDataBase" INTEGER NOT NULL,
    "dataDeposito" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConvencaoPublica_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConvencaoPublica_registroMte_key" ON "ConvencaoPublica"("registroMte");

-- AlterTable (coluna nova anulável)
ALTER TABLE "Convencao" ADD COLUMN "publicaId" TEXT;
CREATE INDEX "Convencao_publicaId_idx" ON "Convencao"("publicaId");
ALTER TABLE "Convencao" ADD CONSTRAINT "Convencao_publicaId_fkey" FOREIGN KEY ("publicaId") REFERENCES "ConvencaoPublica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Sem DROP, sem renomear, sem mudar tipo. Apagar uma `ConvencaoPublica` só desliga a ligação (`SET NULL`); a convenção da conta fica.

## Perguntas para o dono

1. Aplicar a migração agora (só prepara o modelo) ou junto com o compartilhamento?
2. Quem pode criar uma `ConvencaoPublica`: qualquer conta, ou só a equipe da Equapar depois de conferir no Mediador?
3. O compartilhamento entre contas (ver a convenção que outra conta cadastrou) precisa entrar nos termos de uso: decisão com o advogado.
