# Build context: monorepo root
# docker-compose sets: context: .  dockerfile: apps/api/Dockerfile

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json  ./apps/api/
COPY apps/web/package.json  ./apps/web/
RUN npm ci

COPY apps/api/ ./apps/api/

RUN cd apps/api && npx prisma generate
RUN cd apps/api && npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Railpack — download the latest musl binary from GitHub releases (statically linked, works on any Linux)
RUN set -e && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  RP_ARCH="x86_64" ;; \
      aarch64) RP_ARCH="arm64" ;; \
      *) echo "Unsupported arch: $ARCH" >&2 && exit 1 ;; \
    esac && \
    RP_VER=$(curl -fsSL https://api.github.com/repos/railwayapp/railpack/releases/latest \
      | grep -m1 '"tag_name"' | cut -d'"' -f4) && \
    curl -fsSL "https://github.com/railwayapp/railpack/releases/download/${RP_VER}/railpack-${RP_VER}-${RP_ARCH}-unknown-linux-musl.tar.gz" \
      | tar -xz -C /usr/local/bin && \
    chmod +x /usr/local/bin/railpack && \
    railpack --version

# Docker CLI + buildx plugin — railpack forks `docker build` which requires buildx in Docker 23+
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  DOCKER_ARCH="x86_64"; BX_ARCH="amd64" ;; \
      aarch64) DOCKER_ARCH="aarch64"; BX_ARCH="arm64" ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-27.5.1.tgz" \
      | tar -xz -C /usr/local/bin --strip-components=1 docker/docker && \
    docker --version && \
    BX_VERSION=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
      | grep -m1 '"tag_name"' | cut -d'"' -f4) && \
    mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -fsSL "https://github.com/docker/buildx/releases/download/${BX_VERSION}/buildx-${BX_VERSION}.linux-${BX_ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-buildx && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

WORKDIR /app

COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/apps/api/dist    ./dist
COPY --from=builder /app/apps/api/prisma  ./prisma

COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
