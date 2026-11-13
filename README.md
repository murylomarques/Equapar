# Equapar: sistema

Software que leva cada repactuação de contrato público de mão de obra (limpeza, portaria, recepção) do cálculo ao recebimento, com prova.

Documentação: [arquitetura](docs/ARQUITETURA.md) · [regras de cálculo](docs/CALCULO.md) · [operação](docs/OPERACAO.md) · [segurança](docs/SEGURANCA.md) · [LGPD](docs/LGPD.md) · [mudanças](CHANGELOG.md).

## Do zero até rodar

Requisitos: **Node 22.12 ou superior (testado no 24) com npm 11**, e **Docker** (para o PostgreSQL). Funciona em Windows, macOS e Linux.

```bash
git clone https://github.com/murylomarques/Equapar.git
cd Equapar/sistema            # se o repositório tiver a pasta sistema; senão, fique na raiz
npm ci                        # instala exatamente o que está no package-lock.json
cp .env.example .env          # no Windows (PowerShell): Copy-Item .env.example .env
```

Abra o `.env` e preencha **`APP_SECRET`** (32+ caracteres). Para gerar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois:

```bash
docker compose up -d          # PostgreSQL 17 na porta 5440 (usuário e senha de desenvolvimento no docker-compose.yml)
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # dados fictícios + usuário de teste; imprime a senha do dono@exemplo.local
npm run dev                   # http://localhost:3000
```

- Entre com `dono@exemplo.local` e a senha impressa pelo `db:seed`.
- A demonstração (cópia própria dos dados fictícios, por 4 horas) abre em `/demonstracao`.
- Sem as chaves de serviço no `.env`, e-mail, WhatsApp, captcha e alerta de erro ficam **em simulação**: nada sai do servidor, tudo aparece no log e na tela Avisos.

O `DATABASE_URL` do `.env.example` usa `127.0.0.1` de propósito: no Windows, `localhost` pode resolver para IPv6 e o Postgres do Docker não responde.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes de unidade (motor de cálculo, regras de pedido, segurança, máscaras) |
| `npm run typecheck` / `npm run lint` | Checagens estáticas |
| `npm run build && npm start` | Versão de produção |
| `npm run db:seed` | Recria os dados fictícios e o Dono de teste (nova senha). Recusa rodar com `NODE_ENV=production` |
| `npm run db:seed:demo` | Só a conta modelo da demonstração, sem usuário Dono (este pode rodar em produção) |
| `npm run avisos` | Roda a verificação de avisos uma vez |
| `npm run e2e` | Testes no navegador (servidor no ar). Antes, uma vez: `npx playwright install chromium` |
| `npm run e2e:a11y` / `npm run e2e:teclado` | Acessibilidade (axe) e uso só com teclado |

Os testes de navegador leem `BASE_URL` (padrão `http://localhost:3000`), `SENHA_DONO` (a senha impressa pelo `db:seed`) e, opcional, `NAVEGADOR` (ex.: `msedge` para usar o Edge instalado). As falhas bloqueadoras corrigidas têm testes próprios em `e2e/bloqueadoras/`.

## Produção

Veja [docs/OPERACAO.md](docs/OPERACAO.md): imagem Docker (`Dockerfile`, aplica as migrações ao subir), `/api/saude`, armazenamento S3, backup, segredos e como ligar cada integração.

## Pastas

| Pasta | Conteúdo |
| --- | --- |
| `src/app` | Telas e ações (Next.js App Router): `(site)` público, `(auth)` acesso, `app` produto, `api` rotas |
| `src/lib/calculo` | Motor de cálculo determinístico (decimal.js) e seus testes |
| `src/lib` | Regras de negócio, segurança, avisos, documentos, armazenamento |
| `prisma` | Esquema, migrações e dados fictícios (`seed-demo.ts`, `seed-dev.ts`) |
| `scripts` | Rotinas avulsas; as de limpeza rodam em simulação por padrão |
| `e2e` | Testes no navegador (Playwright) |
| `docs` | Documentação, relatórios e capturas |
