# Web app (TanStack Start). Proxies /api and /trpc to the API server at
# SERVER_URL, so only this container needs a public domain.
FROM node:24 AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# Optional: only set when the API is on a different public domain.
ARG VITE_SERVER_URL=""
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN cd apps/web && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3002
ENV SERVER_URL=http://server:3000
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "fetch('http://localhost:'+(process.env.PORT||3002)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web
CMD ["bun", ".output/server/index.mjs"]
