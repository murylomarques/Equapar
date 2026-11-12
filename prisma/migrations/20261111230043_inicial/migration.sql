-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('EMPRESA', 'ASSESSORIA');

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('GRATIS', 'PILOTO', 'CARTEIRA', 'ASSESSORIA');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DONO', 'GERENTE', 'CONTADOR', 'LEITURA');

-- CreateEnum
CREATE TYPE "TipoReajuste" AS ENUM ('REPACTUACAO', 'INDICE');

-- CreateEnum
CREATE TYPE "SituacaoConvencao" AS ENUM ('REGISTRADA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('EM_ANALISE', 'CALCULO_VALIDADO', 'PROTOCOLADO', 'DEFERIDO', 'FATURADO', 'RECEBIDO', 'INDEFERIDO');

-- CreateEnum
CREATE TYPE "Gatilho" AS ENUM ('NOVA_CONVENCAO', 'ACORDO_DISSIDIO', 'OUTRO_CUSTO');

-- CreateEnum
CREATE TYPE "CanalAviso" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatusAviso" AS ENUM ('SIMULADO', 'ENVIADO', 'ERRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "whatsapp" TEXT,
    "whatsappConsentEm" TIMESTAMP(3),
    "totpSegredoCifrado" TEXT,
    "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
    "prefsAvisos" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "contaId" TEXT,
    "empresaId" TEXT,
    "pendente2fa" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL DEFAULT 'EMPRESA',
    "plano" "Plano" NOT NULL DEFAULT 'GRATIS',
    "marcaNome" TEXT,
    "marcaCor" TEXT,
    "mostrarValoresWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "pilotoInicio" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membro" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convencao" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sindicatos" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'Asseio e conservação',
    "cidade" TEXT,
    "uf" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mesDataBase" INTEGER NOT NULL,
    "situacao" "SituacaoConvencao" NOT NULL DEFAULT 'PENDENTE',
    "dataDeposito" TIMESTAMP(3),
    "registroMte" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "orgao" TEXT NOT NULL,
    "orgaoCnpj" TEXT,
    "uf" TEXT,
    "municipio" TEXT,
    "esfera" TEXT,
    "objeto" TEXT NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3) NOT NULL,
    "valorMensal" DECIMAL(14,2),
    "valorGlobal" DECIMAL(16,2),
    "postos" INTEGER,
    "maoDeObraDedicada" BOOLEAN NOT NULL DEFAULT false,
    "tipoReajuste" "TipoReajuste" NOT NULL DEFAULT 'REPACTUACAO',
    "clausulaReajuste" TEXT,
    "convencaoId" TEXT,
    "dataProposta" TIMESTAMP(3),
    "ultimoApostilamento" TIMESTAMP(3),
    "pncpControle" TEXT,
    "linkPncp" TEXT,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'EM_ANALISE',
    "passoAtual" INTEGER NOT NULL DEFAULT 1,
    "gatilho" "Gatilho" NOT NULL DEFAULT 'NOVA_CONVENCAO',
    "convencaoId" TEXT,
    "dataBase" TIMESTAMP(3),
    "dataDeposito" TIMESTAMP(3),
    "descricaoGatilho" TEXT,
    "planilhaAntes" JSONB,
    "planilhaAgora" JSONB,
    "linhasNaoLidas" JSONB,
    "checklist" JSONB,
    "dataReferencia" TIMESTAMP(3),
    "diferencaMensal" DECIMAL(14,2),
    "diferencaRetroativa" DECIMAL(14,2),
    "memoriaAprovadaPor" TEXT,
    "memoriaAprovadaEm" TIMESTAMP(3),
    "revisaoEspecialista" BOOLEAN NOT NULL DEFAULT false,
    "geradoEm" TIMESTAMP(3),
    "protocoloNumero" TEXT,
    "protocoloData" TIMESTAMP(3),
    "respostaData" TIMESTAMP(3),
    "respostaResumo" TEXT,
    "deferidoEm" TIMESTAMP(3),
    "valorDeferido" DECIMAL(14,2),
    "apostiladoEm" TIMESTAMP(3),
    "faturadoEm" TIMESTAMP(3),
    "notaFiscal" TEXT,
    "recebidoEm" TIMESTAMP(3),
    "valorRecebido" DECIMAL(14,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT,
    "pedidoId" TEXT,
    "convencaoId" TEXT,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "caminho" TEXT NOT NULL,
    "enviadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComentarioLinha" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "linhaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioLinha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historico" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "contratoId" TEXT,
    "pedidoId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "contratoId" TEXT,
    "titulo" TEXT NOT NULL,
    "prazo" TIMESTAMP(3),
    "feitaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "contratoId" TEXT,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "canal" "CanalAviso" NOT NULL,
    "destino" TEXT NOT NULL,
    "assunto" TEXT,
    "corpo" TEXT NOT NULL,
    "status" "StatusAviso" NOT NULL,
    "erro" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fatura" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "postos" INTEGER,
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "consentimentoAvisos" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaioXCache" (
    "cnpj" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaioXCache_pkey" PRIMARY KEY ("cnpj")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "props" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Membro_usuarioId_contaId_key" ON "Membro"("usuarioId", "contaId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_contaId_cnpj_key" ON "Empresa"("contaId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_empresaId_pncpControle_key" ON "Contrato"("empresaId", "pncpControle");

-- CreateIndex
CREATE INDEX "Historico_contaId_criadoEm_idx" ON "Historico"("contaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Aviso_contaId_enviadoEm_idx" ON "Aviso"("contaId", "enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Aviso_chave_canal_destino_key" ON "Aviso"("chave", "canal", "destino");

-- CreateIndex
CREATE INDEX "Evento_nome_criadoEm_idx" ON "Evento"("nome", "criadoEm");

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membro" ADD CONSTRAINT "Membro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membro" ADD CONSTRAINT "Membro_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convencao" ADD CONSTRAINT "Convencao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_convencaoId_fkey" FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_convencaoId_fkey" FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_convencaoId_fkey" FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioLinha" ADD CONSTRAINT "ComentarioLinha_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioLinha" ADD CONSTRAINT "ComentarioLinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
