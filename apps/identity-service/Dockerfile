FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @hvac/identity-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=@hvac/identity-service...

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/identity-service/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/identity-service/package.json ./package.json

EXPOSE 4001
CMD ["node", "dist/server.js"]
