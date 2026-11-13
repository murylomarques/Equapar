# Equapar: imagem de produção (Fase 1, 4.1.4).
# Build:  docker build -t equapar .
# Rodar:  docker run --env-file .env -p 3000:3000 equapar            (app; aplica as migrações ao subir)
#         docker run --env-file .env equapar npm run worker          (processo da fila, quando existir)
# Debian slim (não Alpine): o motor do Prisma precisa de OpenSSL e glibc.

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM base AS producao
ENV NODE_ENV=production PORT=3000
# Sem root: usuário sem privilégios
RUN useradd --system --uid 1001 equapar
COPY --from=build --chown=equapar /app/package.json /app/package-lock.json ./
COPY --from=build --chown=equapar /app/node_modules ./node_modules
COPY --from=build --chown=equapar /app/.next ./.next
COPY --from=build --chown=equapar /app/public ./public
COPY --from=build --chown=equapar /app/prisma ./prisma
COPY --from=build --chown=equapar /app/next.config.ts ./next.config.ts
USER equapar
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrações aditivas a cada implantação; depois sobe o app.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
