# Segurança

O que o sistema faz hoje, com o teste que prova cada item. Detalhes e histórico em `docs/produto-pronto/RELATORIO.md`.

## Acesso

| Proteção | Onde | Prova |
| --- | --- | --- |
| Senha pelo NIST SP 800-63B: 15+ caracteres (8 com duas etapas), até 64, sem regra de composição, recusa comuns, repetidas e o próprio e-mail | `src/lib/senha.ts` | `senha.test.ts` |
| Limite de tentativas no banco: 5 por e-mail e 30 por IP em 15 min; IP só do proxy de confiança | `src/lib/limite.ts` | `limite.test.ts`, `e2e/bloqueadoras/s1-limite.mjs` |
| Conta inexistente leva o mesmo tempo para responder (hash falso) | `conferirSenha` | — |
| Confirmação de e-mail por link assinado (24 h); sem confirmar, sem avisos | `src/lib/confirmacao-email.ts` | `c7-confirmar-email.mjs` |
| Google numa conta existente: anula a senha se o e-mail nunca foi confirmado, derruba as outras sessões, avisa | `api/auth/google/callback` | `route.test.ts` |
| Duas etapas: trocar exige código ou senha; segredo novo pendente até confirmar; 10 códigos de recuperação de uso único (só hash) | `configuracoes/acoes.ts`, `src/lib/recuperacao.ts` | `dois-fatores.test.ts`, `assessoria-2fa.mjs` |
| Esqueci a senha: link de 1 hora e uso único; encerra todas as sessões | `src/lib/redefinir-senha.ts` | `s11-esqueci-senha.mjs` |
| Convite sem senha temporária: link de 7 dias, a pessoa define a senha | `src/lib/convite.ts` | `s12-convite.mjs` |
| Sessão no banco; cookie `__Host-` com Secure em produção (HTTPS) | `src/lib/auth.ts`, `cookie-sessao.ts` | `cookie-sessao.test.ts` |
| Nova sessão nunca apaga a de outra pessoa no mesmo navegador | `criarSessao` | `c6-demo-sessoes.mjs` |

## Dados de cada conta

- Toda leitura e escrita passa por `exigir()`/`contexto()` e filtra pela conta da sessão (`contratoDaConta`, `pedidoDaConta`, consultas com `contaId`).
- A demonstração é uma conta própria por visitante, bloqueada para gerenciar a conta, senha, duas etapas e sessões; nunca envia mensagem.
- "Verificar prazos agora" roda só a conta atual (`avisos.test.ts`).

## Navegador

| Cabeçalho | Valor |
| --- | --- |
| Content-Security-Policy | Páginas dinâmicas: nonce por requisição + `'strict-dynamic'`. Páginas geradas no build: sem nonce (`'unsafe-inline'` nos scripts), pois o HTML pronto não leva nonce; não têm dado de usuário. `frame-ancestors 'none'` |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-Content-Type-Options | nosniff |
| Permissions-Policy | câmera, microfone, localização, pagamento e USB desligados |
| Strict-Transport-Security | só em produção |

Prova: `e2e/bloqueadoras/s3-cabecalhos.mjs` (confere também que toda página estática do build recebe a CSP certa).

## Arquivos

- O conteúdo real precisa bater com a extensão (PDF, XLSX, DOCX, PNG, JPEG, CSV); o tipo gravado é o detectado (`arquivo-tipo.ts`).
- Download sempre como anexo, nome em `filename*=UTF-8''`.
- Em produção, bucket privado e cifrado; download por link assinado de 5 minutos depois de conferir a permissão.

## Formulários públicos

- Cotas por dia no banco: 3 mensagens do Raio-X por e-mail destino, 10 por IP, 60 consultas por IP (`cota.ts`).
- Captcha Turnstile (simulação sem chave).
- Webhook do WhatsApp: assinatura conferida (`WHATSAPP_APP_SECRET`) e JSON inválido responde 400.

## Erros

A pessoa vê uma mensagem clara com "código do erro"; o detalhe técnico vai só para o log (JSON, com o id da requisição) e para o alerta de erro (`registro.ts`).

## A fazer (decisão do dono ou fase seguinte)

- Teste automático "nenhuma ação muda dados de outra conta" para cada ação de servidor (seção 7 da definição de pronto).
- Chaves reais: Turnstile, alerta de erro, provedor de armazenamento.
- Consulta de senha em base de vazamentos (hoje a lista é local).
