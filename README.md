# Equapar: sistema

Software que leva cada repactuação do cálculo ao recebimento, com prova. Implementa o "Dossiê da Startup Equapar (v2)" e a aba "Produto e experiência" (pasta acima desta).

## Como rodar (Windows, macOS ou Linux)

Requisitos: Node 22 ou superior (testado no 24) e Docker.

```bash
npm install
cp .env.example .env        # gere APP_SECRET (o comando está no arquivo)
npm run setup               # sobe o Postgres (porta 5440), aplica as migrações e cria os dados de demonstração
npm run dev                 # http://localhost:3000
```

O `setup` imprime a senha do usuário de teste `dono@exemplo.local` (papel Dono, dados fictícios). A demonstração somente leitura abre em `/demonstracao`.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes do motor de cálculo e da leitura de Excel (16 testes) |
| `npm run build && npm start` | Versão de produção |
| `npm run e2e` | Testes ponta a ponta no navegador (Edge; com o servidor no ar; `BASE_URL` e `NAVEGADOR=chrome` opcionais) |
| `npm run avisos` | Roda a verificação de avisos uma vez |
| `npm run db:seed` | Recria só a conta de exemplo (gera nova senha) |
| `npm run typecheck` / `npm run lint` | Checagens estáticas |

## O que está pronto

**Site:** landing com os 12 blocos e textos da aba de produto, Raio-X por CNPJ (PNCP), relatório em PDF com consentimento, Preços, Para assessorias, 4 guias para o Google, Privacidade e Termos (minutas).

**Produto:** Hoje, Carteira (filtros e ação em lote por convenção), Contrato (Resumo, Prazos com regra e fonte, Pedidos, Documentos, Histórico), Decisão de prorrogação (3 casos, texto da ressalva para copiar), assistente de pedido em 5 passos com salvamento automático, Memória de cálculo (linha a linha, comentários, aprovação só por Contador ou Dono), Pedido pronto (ofício em Word e PDF, planilha em Excel, memória em PDF, ZIP), os 6 estados do dinheiro até "recebido", A receber, Convenções, Clientes e seletor para assessorias (PDFs com a marca da assessoria), Avisos, Busca e Configurações (empresa, pessoas e papéis, avisos, cobrança, 2FA e sessões, exportar e excluir conta).

**Avisos:** 60, 30 e 7 dias, protocolo, deferimento, 30 dias sem apostilamento e resumo semanal de segunda-feira. Modelos de WhatsApp como no documento, "SAIR" encerra os avisos e os eventos de métrica não levam dado pessoal.

**Motor de cálculo** (`src/lib/calculo`): estrutura da IN SEGES/MP 05/2017, Anexo VII-D (módulos 1 a 6). Usa aritmética decimal exata, arredonda cada linha a 2 casas (meio para cima), calcula os tributos por dentro e o retroativo mês a mês, com pro rata por dia. **Nenhum percentual vem pré-definido:** o usuário digita ou confirma tudo. A IA nunca produz o número final.

**Qualidade:** testes de unidade com valores conferidos por cálculo independente, mais um teste ponta a ponta em navegador real cobrindo do cadastro ao "recebido", assessoria, 2FA e telas de celular sem rolagem horizontal.

## Modo simulação (integrações sem chave)

Com as chaves vazias no `.env`, nada sai da máquina. As mensagens são montadas e registradas em **Avisos**.

| Integração | Variáveis | Sem a chave |
| --- | --- | --- |
| E-mail (SMTP) | `SMTP_URL`, `EMAIL_FROM` | Simulado |
| WhatsApp Cloud API (Meta) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Simulado |
| Leitura de planilha em PDF (Claude) | `ANTHROPIC_API_KEY` | Só Excel ou digitação |
| Entrar com Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Botão escondido |
| Agendador externo | `CRON_SECRET` (e `AVISOS_AUTOMATICOS=false`) | Verificação a cada hora dentro do servidor |

Os modelos de WhatsApp precisam ser aprovados na Meta com estes nomes: `equapar_prazo_60`, `equapar_prazo_30`, `equapar_prazo_7`, `equapar_prazo_resposta` e `equapar_deferido` (textos em `src/lib/mensagens.ts`).

## O que ainda depende de você antes de vender

1. **PNCP:** a busca por fornecedor usa a pesquisa pública do portal (`/api/search`), porque a API de consulta não filtra por CNPJ do fornecedor. Neste ambiente de desenvolvimento, o firewall do PNCP derrubou as conexões do servidor (ECONNRESET), enquanto o mesmo endereço respondia pelo navegador e pelo curl. O sistema mostra a mensagem de "PNCP não respondeu" e oferece o aviso por e-mail. Confirme o acesso a partir do servidor de produção e as regras de uso do portal.
2. **Revisão jurídica:** do modelo de ofício, do texto de ressalva, da política de privacidade e dos termos (o Dossiê prevê de R$ 5 mil a R$ 10 mil).
3. **Validação do cálculo com especialista** usando planilhas reais dos pilotos. As bases de cada linha seguem o modelo da IN, mas cada planilha real pode ter particularidades.
4. **Dados institucionais** em `src/lib/site.ts` (razão social, CNPJ, endereço, WhatsApp, nome e foto do fundador), marcados com `[PREENCHER]`.
5. **Pagamento online:** a tela de cobrança registra o plano e calcula R$ 4 por posto (mínimo R$ 297), mas não cobra cartão nem boleto.
6. **Hospedagem e domínio:** nada foi publicado. Para produção, use um Postgres gerenciado, armazenamento de arquivos persistente (`STORAGE_DIR`) e HTTPS.
7. **Vídeo da landing:** no lugar do vídeo de 2 minutos, o link "Ver a tela por dentro" abre a demonstração ao vivo, só leitura e com dados fictícios.

## Estrutura

```
prisma/schema.prisma      modelo de dados (contas, empresas, contratos, convenções, pedidos, avisos, eventos)
prisma/seed.ts            dados de demonstração fictícios
src/lib/calculo/          motor de cálculo + testes
src/lib/prazos.ts         regras de prazo, com fonte (TCU, Lei 14.133)
src/lib/documentos.ts     ofício, planilha, memória, ZIP, relatório do Raio-X
src/lib/avisos.ts         rotina de avisos
src/lib/pncp.ts           consulta ao PNCP (descarta pessoa física)
src/app/(site)/           site público
src/app/(auth)/           entrar, criar conta, 2FA
src/app/app/              produto
```
