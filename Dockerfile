# Imagem de produção da aplicação Next.
#
# O banco e a autenticação são serviços gerenciados (Supabase), então aqui só
# vive o servidor Next. As migrations NÃO rodam no start do contêiner: são um
# passo separado do deploy (`npm run db:deploy`), para não haver duas réplicas
# tentando migrar o mesmo banco ao mesmo tempo.
#
#   docker build -t personal-app .
#   docker run --rm -p 3000:3000 --env-file .env.producao personal-app

# --------------------------------------------------------------- dependências
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# `npm ci` respeita o lockfile. O client do Prisma é gerado no estágio de
# build, onde as variáveis existem: `prisma.config.ts` lê DIRECT_URL ao ser
# carregado, e não há `.env` dentro da imagem.
RUN npm ci

# --------------------------------------------------------------------- build
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# As NEXT_PUBLIC_* são embutidas no bundle no momento do build - por isso
# precisam existir aqui, e não só em tempo de execução. São valores públicos
# (URL do projeto e chave anônima); nenhum segredo entra na imagem.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# O build não conecta no banco: o client do Prisma é gerado a partir do
# schema. Os valores abaixo existem só para as variáveis não ficarem vazias.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ------------------------------------------------------------------ execução
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégios: nada aqui precisa de root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` já traz só as dependências usadas pelo servidor.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Sem shell no meio: o processo do node vira PID 1 e recebe o SIGTERM.
CMD ["node", "server.js"]
