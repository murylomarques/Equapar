# E-mail: como ligar (G6)

Sem e-mail, ninguém confirma a conta nem recebe aviso de prazo. Não escolhemos provedor e nenhuma chave fica no repositório: tudo vai para o painel de segredos da hospedagem (`SMTP_URL` e `EMAIL_FROM`).

## 1. Provedor e variáveis

1. Contrate um provedor de e-mail transacional (exemplos: Amazon SES, Postmark, Resend, Brevo).
2. Preencha `SMTP_URL` (formato `smtps://usuario:senha@smtp.exemplo.com:465`) e `EMAIL_FROM` (ex.: `Equapar Avisos <avisos@equapar.com.br>`).
3. Rode `npm run verificar:producao`: ele conecta e autentica no SMTP sem enviar nada. Depois use o botão **"Enviar e-mail de teste"** no painel interno (ou `npm run verificar:producao -- --enviar-teste`): a mensagem vai para os endereços de `PAINEL_EMAILS`, e se falhar a tela mostra o erro exato do provedor.

Enquanto `SMTP_URL` ou `EMAIL_FROM` faltarem em produção, o `/api/saude` devolve o aviso `email_nao_configurado` e o painel interno mostra o mesmo aviso no topo. O sistema sobe assim mesmo.

## 2. DNS do domínio equapar.com.br

| Registro | Para quê | Como |
| --- | --- | --- |
| **SPF** | Diz quais servidores podem enviar pelo domínio | TXT em `equapar.com.br`, com o valor que o provedor indicar (ex.: `v=spf1 include:<provedor> ~all`). Um único registro SPF por domínio. |
| **DKIM** | Assina cada mensagem | Os registros (CNAME ou TXT) que o provedor gerar para o domínio. |
| **DMARC** | Diz o que fazer quando SPF/DKIM falham | TXT em `_dmarc.equapar.com.br`. Comece com `v=DMARC1; p=none; rua=mailto:dmarc@equapar.com.br` (só monitora). Depois de semanas sem falhas, suba para `p=quarantine` e, por fim, `p=reject`. |
| **DNS reverso (PTR)** | O IP de envio aponta de volta para um nome válido | Normalmente feito pelo provedor; confira na documentação dele. |
| **TLS** | Conexão cifrada até o servidor de e-mail | Use `smtps://` (porta 465) ou STARTTLS (porta 587). |

## 3. Regras do Google para remetentes

Fonte: [Google: regras para remetentes de e-mail](https://support.google.com/a/answer/81126).

- **Qualquer remetente:** SPF **ou** DKIM configurado, DNS reverso válido, conexão com TLS e taxa de spam abaixo de **0,3%** (o ideal é abaixo de 0,1%).
- **Acima de 5.000 mensagens por dia para contas do Gmail:** SPF **e** DKIM **e** DMARC (pelo menos `p=none`), alinhamento do domínio do remetente e cancelamento de inscrição com um clique nas mensagens de marketing.

Os avisos da Equapar são mensagens transacionais (prazos, confirmações). Mesmo assim, mantenha o volume e as reclamações baixos: quem pede para sair dos avisos deixa de recebê-los.
