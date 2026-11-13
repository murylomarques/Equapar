# Arquitetura

## Desenho

```
Navegador ──HTTPS──> Proxy de confiança (TLS, IP do cliente em TRUSTED_PROXY_HEADER)
                       │
                       ▼
              App Next.js (sem estado, N instâncias)
              ├─ src/proxy.ts: CSP com nonce, x-request-id
              ├─ telas (React Server Components) e ações de servidor
              └─ /api: downloads, webhooks, saúde, cron
                 │                │                     │
                 ▼                ▼                     ▼
          PostgreSQL        Armazenamento S3     Serviços externos (só com chave;
          (dados, sessões,  (bucket privado,     sem chave = simulação):
           limites, cotas,   chaves por conta,   SMTP, WhatsApp/Meta, Google,
           fila na fase 1)   links assinados)    Anthropic (PDF), Turnstile, alerta de erro
                 ▲
                 │
          Worker (fase 1: `npm run worker`, processo separado: avisos, PNCP, exportação, envios)
```

## Decisões e o porquê

| Decisão | Por quê |
| --- | --- |
| Next.js App Router, ações de servidor | Uma base só para site, produto e rotas; formulários funcionam com pouco JavaScript |
| Motor de cálculo puro (decimal.js), separado da tela | O mesmo código calcula na tela e no servidor; testável centavo a centavo; regra versionada (`VERSAO_REGRA`) |
| PostgreSQL também para sessões, limites e cotas | Nada em memória do processo: várias instâncias e reinícios não perdem estado nem furam o limite de tentativas |
| Fila no próprio PostgreSQL (fase 1) | Sem serviço novo para operar; volume baixo; transação junto com os dados |
| Armazenamento atrás de interface (disco ou S3) | App sem estado em produção; desenvolvimento simples no disco |
| Links assinados sem tabela (confirmação de e-mail, senha, convite) | Vencem sozinhos; "uso único" pela impressão do hash da senha; menos dado guardado |
| Integrações em modo simulação por padrão | Nada é enviado a terceiro sem a chave e sem a decisão do dono |
| Demonstração isolada por visitante | Visitante experimenta montar pedido sem ver nem afetar os outros; nada é enviado |
| Páginas públicas estáticas | Carregamento rápido no celular; a CSP delas não pode ter nonce (ver Segurança) |

## Onde está cada coisa

- **Regras do pedido**: `src/lib/pedido.ts`, `src/lib/pedido-regras.ts` (pendências, aprovação, assinatura do cálculo).
- **Acesso e permissões**: `src/lib/auth.ts` (`exigir`, `exigirUsuario`, demonstração), `src/lib/limite.ts`, `src/lib/cota.ts`.
- **Avisos**: `src/lib/avisos.ts` (quem recebe, quando) e `src/lib/mensagens.ts` (envio ou simulação, modelos do WhatsApp).
- **Documentos**: `src/lib/documentos.ts` (ofício, memória, planilha Excel, ZIP).
- **Arquivos**: `src/lib/armazenamento.ts` e `src/lib/storage.ts`.
- **Logs e erros**: `src/lib/registro.ts`; mensagens para a pessoa em `src/lib/acao.ts`.
