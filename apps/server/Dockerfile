# API server (Hono + tRPC). Applies database migrations on start.
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

ENV NODE_ENV=production
RUN cd apps/server && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV PORT=3000
ENV STORAGE_PATH=/data/storage
RUN mkdir -p /data/storage
VOLUME ["/data/storage"]
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD bun -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/server
CMD ["sh", "-c", "bun /app/packages/db/src/migrate.ts && exec bun dist/index.mjs"]
