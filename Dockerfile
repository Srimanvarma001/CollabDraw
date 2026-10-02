# One Dockerfile for every service; pick one with --target:
#   http-backend, ws-backend, frontend, migrate
# docker-compose.yml builds them all.

FROM node:22-slim AS base
# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Install dependencies once for the whole workspace.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/http-backend/package.json apps/http-backend/
COPY apps/ws-backend/package.json apps/ws-backend/
COPY packages/backend-common/package.json packages/backend-common/
COPY packages/common/package.json packages/common/
COPY packages/db/package.json packages/db/
COPY packages/typescript-config/package.json packages/typescript-config/
# The db package generates the Prisma client on install, so it needs its schema.
COPY packages/db/src/prisma packages/db/src/prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
# NEXT_PUBLIC_* values are compiled into the frontend bundle.
ARG NEXT_PUBLIC_HTTP_BACKEND=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8080
ENV NEXT_PUBLIC_HTTP_BACKEND=$NEXT_PUBLIC_HTTP_BACKEND \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm turbo run build

FROM build AS migrate
WORKDIR /app/packages/db
CMD ["pnpm", "db:migrate"]

FROM build AS http-backend
ENV NODE_ENV=production
WORKDIR /app/apps/http-backend
EXPOSE 3001
CMD ["node", "dist/index.js"]

FROM build AS ws-backend
ENV NODE_ENV=production
WORKDIR /app/apps/ws-backend
EXPOSE 8080
CMD ["node", "dist/index.js"]

FROM build AS frontend
ENV NODE_ENV=production
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["pnpm", "start"]
