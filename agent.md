
# AGENT.md — brimble-pipeline

## Project Overview
A mini-PaaS deployment pipeline. Users submit a Git URL or upload a project.
The system builds it into a Docker image using Railpack, runs it as a container,
and Caddy reverse-proxies a subdomain URL to it. Logs stream live to the UI over SSE.

## Monorepo Structure
```
brimble-pipeline/
├── apps/
│   ├── api/          → NestJS backend (port 3001)
│   └── web/          → Vite + React + TanStack (port 5173)
├── infra/
│   ├── caddy/        → Caddyfile
│   └── sample-app/   → Express hello-world for testing
├── docker-compose.yml
├── .env.example
└── AGENT.md
```

## Tech Stack — Do Not Change These
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Queue**: BullMQ + Redis
- **Frontend**: Vite + React + TypeScript + TanStack Router + TanStack Query + shadcn/ui + Tailwind CSS v4
- **Build**: Railpack CLI (child_process)
- **Containers**: Docker via dockerode
- **Ingress**: Caddy (Admin API on port 2019)
- **Encryption**: Node.js built-in crypto (AES-256-GCM) — no external crypto libraries

## NestJS Module Structure — Do Not Restructure
```
src/
├── app.module.ts
├── main.ts
├── database/         → PrismaService
├── deployments/      → DeploymentsModule, DeploymentsController, DeploymentsService
│   ├── dto/          → CreateDeploymentDto, EnvVarInputDto, EnvVarResponseDto
│   ├── entities/     → Deployment entity
│   └── env-vars.service.ts
├── pipeline/         → PipelineModule, PipelineService, DockerService, CaddyService, HealthService
├── logs/             → LogsModule, LogsService, LogsController
├── metrics/          → MetricsModule, MetricsService, MetricsController
├── queue/            → QueueModule, QueueService, DeploymentProcessor
├── ports/            → PortsModule, PortsService
├── crypto/           → CryptoModule, CryptoService
├── events/           → EventsModule, EventsService
└── webhooks/         → WebhooksModule, WebhooksController, WebhooksService
```

## Prisma Models — Do Not Change Schema Without Migration
- **Deployment** — id, name, source, sourceType, status, imageTag, containerId, url, port, routeId, createdAt, updatedAt
- **Log** — id, deploymentId, line, stream, phase, ts
- **Build** — id, deploymentId, imageTag, durationMs, cacheHit, createdAt
- **PortAllocation** — id, port (unique), deploymentId (unique), createdAt
- **DeploymentEvent** — id, deploymentId, type, message, metadata, ts
- **EnvVar** — id, deploymentId, key, encryptedValue, iv, createdAt, updatedAt

Always run after schema changes:
```bash
cd apps/api && npx prisma migrate dev --name <migration-name>
cd apps/api && npx prisma generate
```

## Deployment Pipeline — Exact Status Flow
```
pending → building → deploying → health_check → routing → running
                                                         → failed (any step)
                                                         → stopped (deleted)
```

## Critical Implementation Rules

### PipelineService
- Railpack runs as child_process — capture stdout/stderr line by line
- Every log line → LogsService.append(deploymentId, line, stream, phase)
- Status transitions must follow exact flow above — never skip steps
- Build cache: pass --cache-from and --cache-to flags pointing to /cache/<name>
- Record Build after successful Railpack build with durationMs and cacheHit

### LogsService
- Each log line does TWO things: persist to DB AND Subject.next() for SSE
- RxJS Subject per deploymentId — fan-out to all active SSE subscribers
- On SSE connect: replay persisted logs from DB first, then subscribe to Subject
- Never buffer — stream line by line as they arrive

### DockerService
- Always call portsService.acquirePort() — never generate random ports
- Resource limits on every container: 512MB memory, 50% CPU (NanoCpus: 500000000)
- Always call metricsService.startMetrics() after container starts
- Env vars: call envVarsService.getDecrypted(deploymentId) — never log values, only keys
- Graceful shutdown: SIGTERM → wait 10s polling inspect() → SIGKILL

### CaddyService
- Routes use HOST matching (subdomain) not path matching
- Subdomain format: {name}-{deploymentId.slice(0,8)}.localhost
- Store routeId on Deployment record when adding route
- removeRoute() uses stored routeId to DELETE via Caddy Admin API
- Always insert new routes BEFORE the fallback route

### PortsService
- acquirePort() must use Prisma transaction — never select + insert without transaction
- Range: 10000–20000
- releasePort() deletes PortAllocation record

### CryptoService
- AES-256-GCM only — no other algorithm
- Random 16-byte IV per encryption
- Format stored: iv:authTag:encryptedData (hex encoded, colon separated)
- Throw on startup if ENCRYPTION_KEY missing or < 32 chars
- Never log decrypted values anywhere

### EnvVarsService
- getMasked() always returns '***' for values — never decrypted in API responses
- getDecrypted() is internal only — only called by DockerService
- No API endpoint ever returns decrypted values

### HealthService
- Poll http://host.docker.internal:{port}/ every 2s
- Default: 10 retries, 2000ms interval, 20000ms timeout
- Log each attempt via LogsService so it appears in UI terminal
- Return false after exhausting retries — PipelineService sets status to failed

### QueueService / DeploymentProcessor
- POST /deployments creates DB record + adds BullMQ job — never runs pipeline directly
- Processor calls PipelineService.run(deploymentId)
- On job failure: update deployment status to failed

## SSE Endpoints — Standard Pattern
All SSE endpoints follow this pattern:
```typescript
@Get(':id/logs')
async streamLogs(@Param('id') id: string, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
  
  const subscription = this.logsService.stream(id).subscribe({
    next: (line) => res.write(`data: ${JSON.stringify(line)}\n\n`),
    error: () => res.end(),
    complete: () => res.end()
  })
  
  req.on('close', () => subscription.unsubscribe())
}
```

## Frontend Rules — Do Not Change
- shadcn/ui components only — no custom component libraries
- Tailwind CSS v4 utility classes
- Dark theme forced: <html class="dark"> in index.html
- Design tokens: zinc-950 bg, zinc-900 surface, zinc-800 borders, emerald-500 accent
- Font: Geist Mono for code/terminal, system font for UI
- TanStack Query for all data fetching — no raw fetch in components
- TanStack Router for routing — single route (index)
- All API calls go through lib/api.ts typed wrapper
- No any types anywhere

## Frontend Component Map — Do Not Rename
```
components/
├── Topbar.tsx          → logo + stat pills + new deployment button
├── DeployForm.tsx      → git url / upload tabs + env vars section
├── DeploymentList.tsx  → list + empty state + loading skeletons
├── DeploymentCard.tsx  → card + actions + expanded panels
├── StatusBadge.tsx     → colored dot + status text
├── LogStream.tsx       → SSE terminal + phase filter tabs
├── MetricsPanel.tsx    → CPU/memory bars + uptime counter
├── ActivityFeed.tsx    → timeline of deployment events
├── EnvVarsPanel.tsx    → masked env vars table + edit mode
└── Spinner.tsx         → loading spinner
```

## API Endpoints — Complete List
```
POST   /deployments                    → create + queue job
GET    /deployments                    → list all
GET    /deployments/:id                → single deployment
DELETE /deployments/:id                → graceful stop + cleanup
GET    /deployments/:id/logs           → SSE log stream
GET    /deployments/:id/metrics        → SSE metrics stream
GET    /deployments/:id/env            → masked env vars
PATCH  /deployments/:id/env            → update env vars (triggers redeploy)
GET    /deployments/:id/builds         → build history for rollback
POST   /deployments/:id/rollback       → rollback to previous image tag
GET    /deployments/:id/events         → activity feed
POST   /webhooks/github                → GitHub push webhook (HMAC verified)
GET    /config/webhook-url             → returns webhook URL for UI display
```

## Environment Variables — Required
```
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/brimble

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Caddy
CADDY_ADMIN_URL=http://caddy:2019

# Encryption — MUST be 32+ characters
ENCRYPTION_KEY=your-super-secret-key-minimum-32-characters-long

# Docker
DOCKER_HOST_IP=host-gateway

# Webhooks
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
API_BASE_URL=http://localhost:3001

# Frontend
VITE_API_URL=http://localhost:3001
```

## Docker Compose Services — Do Not Add or Remove
- **api** — NestJS, port 3001, mounts /var/run/docker.sock and /cache
- **web** — Vite/nginx, port 5173
- **caddy** — caddy:2-alpine, ports 80 + 2019
- **db** — postgres:16-alpine, port 5432
- **redis** — redis:7-alpine, port 6379

Volumes:
- pgdata → postgres data
- railpack_cache → /cache for build cache

## What NOT To Do
- Do NOT use axios — use Node fetch or http module
- Do NOT use any external crypto libraries — Node built-in crypto only
- Do NOT generate random ports — always use PortsService.acquirePort()
- Do NOT call PipelineService directly from controllers — always go through QueueService
- Do NOT return decrypted env var values in any API response
- Do NOT log env var values — log keys only
- Do NOT use dynamic imports or lazy loading
- Do NOT add Kubernetes, Helm, or any orchestration beyond what exists
- Do NOT change the Prisma schema without running a migration
- Do NOT use localStorage or sessionStorage in the frontend
- Do NOT add new npm packages without checking if the functionality 
  exists in already-installed packages first

## When Adding New Features
1. Check this AGENT.md first — the architecture is intentional
2. Follow existing patterns — SSE, queue, service injection
3. Add to the correct module — don't create new modules without reason
4. Run prisma migrate if schema changes
5. Update API endpoint list in this file
6. No any types — strict TypeScript throughout

## Build Commands
```bash
# Local development
docker compose up

# API only
cd apps/api && npm run start:dev

# Web only  
cd apps/web && npm run dev

# Prisma
cd apps/api && npx prisma migrate dev --name <name>
cd apps/api && npx prisma generate
cd apps/api && npx prisma studio

# Fresh start
docker compose down -v && docker compose up --build
```
```
