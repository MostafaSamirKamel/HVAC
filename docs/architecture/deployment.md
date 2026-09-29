# Deployment, Infrastructure & Lifecycle Management

## 1. Overview & Deployment Targets

The HVAC ERP platform is designed to deploy across two primary targets:
1. **Local / Staging**: Docker Compose (Infrastructure only via `docker-compose.dev.yml` or complete full-stack via `docker-compose.yml`).
2. **Production**: Kubernetes / Managed Containers (AWS EKS, GCP GKE, Azure AKS, or On-Premise K8s).

---

## 2. Local Infrastructure Stack (`docker-compose.dev.yml`)

The development environment boots all foundational dependencies with health checks in a single command:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Components Started
- **MongoDB 7.0 Replica Set (`rs0`)**: Running on port `27017` with automatic replica set initialization (`init-replica-set.js`).
- **Redis 7.2 Alpine**: Running on port `6379` for distributed locking, cache, and BullMQ queues.
- **RabbitMQ 3.13 Management**: Running AMQP on port `5672` and Web Management Console on port `15672` (Credentials: `guest`/`guest`).
- **MinIO Object Storage**: Running S3 API on port `9000` and Web Console on port `9001` (Credentials: `minioadmin`/`minioadmin`).

---

## 3. Production Multi-Stage Container Strategy

Each service contains an optimized multi-stage `Dockerfile` leveraging **Turbo Prune**:

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

# Stage 1: Prune monorepo dependencies for the target service
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @hvac/sales-service --docker

# Stage 2: Install dependencies
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Compile TypeScript
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=@hvac/sales-service...

# Stage 4: Minimal runner image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/sales-service/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/sales-service/package.json ./package.json

EXPOSE 4005
CMD ["node", "dist/server.js"]
```

---

## 4. Standard Environment Variables

| Variable | Description | Default / Example |
|:---|:---|:---|
| `PORT` | Listening HTTP port for the application | `4001` - `4013` (or `3000` for Gateway) |
| `NODE_ENV` | Runtime environment mode | `development` / `production` / `test` |
| `MONGO_URI` | MongoDB connection URI with Replica Set | `mongodb://mongodb:27017/hvac_erp?replicaSet=rs0` |
| `REDIS_URI` | Redis connection URI | `redis://redis:6379` |
| `RABBITMQ_URI` | RabbitMQ AMQP connection URI | `amqp://guest:guest@rabbitmq:5672` |
| `JWT_SECRET` | Signing secret for client JWT tokens | *Secret 64-char random string* |
| `INTERNAL_SERVICE_SECRET`| Shared secret for Gateway-to-Service tokens | *High-entropy secret string* |
| `S3_ENDPOINT` | S3 / MinIO API endpoint URL | `http://minio:9000` |
| `S3_BUCKET` | Attachments bucket name | `hvac-erp-attachments` |

---

## 5. Kubernetes Readiness & Graceful Shutdown (Blueprint v2.0 Section 54)

Every service implements the 11-step graceful shutdown protocol upon receiving `SIGTERM` or `SIGINT`:
1. Mark readiness probe false (`/health/ready` returns `503 Service Unavailable`).
2. Stop accepting new inbound HTTP traffic from load balancers.
3. Stop RabbitMQ consumers and cancel channel leases.
4. Stop BullMQ worker processing.
5. Finish in-flight HTTP requests cleanly.
6. Commit or abort active MongoDB sessions and transactions.
7. Close RabbitMQ broker connection.
8. Close Redis client connections.
9. Close MongoDB client connection pool.
10. Flush Pino logs and OpenTelemetry trace spans.
11. Exit process cleanly (`process.exit(0)`).
