# Build context: monorepo root
# docker-compose sets: context: .  dockerfile: apps/web/Dockerfile

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:7401
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY apps/api/package.json  ./apps/api/
COPY apps/web/package.json  ./apps/web/
RUN npm ci

COPY apps/web/ ./apps/web/

RUN cd apps/web && npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
