# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# corepack ships with Node 22 — use it for pnpm
RUN corepack enable

# Install dependencies first (layer-cache friendly)
COPY package.json pnpm-lock.yaml ./
# better-sqlite3 needs python + make + g++ to compile native bindings
RUN apk add --no-cache python3 make g++
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build


# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# libstdc++ is needed by the better-sqlite3 native addon at runtime
RUN apk add --no-cache libstdc++

# Copy built server output
COPY --from=builder /app/dist ./dist

# Copy node_modules (includes compiled native addons — can't re-compile in runtime)
COPY --from=builder /app/node_modules ./node_modules

# Copy DB migrations so drizzle can run them on startup
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Writable data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 4321

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

CMD ["node", "dist/server/entry.mjs"]
