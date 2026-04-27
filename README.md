# brimble-pipeline

A mini-PaaS deployment pipeline: submit a Git URL, get a live URL back. Logs stream in real-time.

## Architecture

```
Browser
  │
  ├── GET /deployments (TanStack Query, polls 3s while non-terminal)
  ├── POST /deployments (mutation → optimistic refetch)
  └── GET /deployments/:id/logs (EventSource / SSE)

NestJS API (:3001)
  │
  ├── DeploymentsController
  │     └── POST /deployments ──► QueueService.addDeploymentJob()
  │                                        │
  │                               BullMQ "deployments" queue
  │                                        │
  │                               DeploymentProcessor.process()
  │                                        │
  │                               PipelineService.run(deploymentId)
  │                               ┌────────┴──────────┐
  │                          Railpack CLI          DockerService
  │                         (child_process)        .runContainer()
  │                               │                     │
  │                          Build record          PortsService
  │                         in DB (Build)          .acquirePort()
  │                               │                     │
  │                               └────────┬────────────┘
  │                                        │
  │                                  HealthService
  │                                  .waitForHealthy()
  │                                  (polls http GET, 10 retries × 2s)
  │                                        │
  │                                  CaddyService
  │                                  .addRoute()
  │                                  (Caddy Admin API :2019)
  │                                        │
  │                              status = "running"
  │
  └── LogsService (RxJS Subject per deployment)
        ├── persists every line to Log table (with phase)
        └── fans out to active SSE subscribers
```

## Status lifecycle

```
pending → building → deploying → health_check → routing → running
                                                              ↓
                                                           stopped (DELETE)
Any step that throws → failed
```

## Why BullMQ over raw async

Raw `fire-and-forget` (`this.pipeline.run().catch(...)`) silently drops jobs on API restart.
BullMQ persists jobs in Redis so an in-flight deployment survives a container restart.
It also gives retry configuration, dead-letter queues, and a Bull Board UI for free.

## Why health checks before route registration

Registering a Caddy route before the container is ready causes a window where users
hit 502s. The health poller (10 × 2 s) waits for any non-5xx response before telling
Caddy to route traffic, eliminating that window.

## Why port allocator in DB vs random ports

Random ports (original approach) have a birthday-problem collision risk that grows
quadratically: with ~300 deployments you have a >1% chance of a collision per launch.
The DB allocator does a single `INSERT … UNIQUE` per port — any race is caught by the
unique constraint and retried immediately. No coordinator needed.

## Container resource limits

Each container is capped at 512 MB RAM (swap disabled), 50% of one CPU core.
Without limits a single misbehaving app can OOM the host or starve other containers.
`RestartPolicy: no` means the pipeline — not Docker — controls the container lifecycle,
so a crash doesn't silently spin up a new container that bypasses health checks.

## Rollback

Rollback runs the existing image tag through the full `deploying → health_check → routing`
sequence on a temporary port key (`${deploymentId}_rb`), atomically swaps the Caddy route
once healthy, then gracefully stops the old container. If health checks fail the rollback
container is torn down and the original is left running.

## Running locally

```bash
cp .env.example .env
docker-compose up --build
# API:  http://localhost:3001
# Web:  http://localhost:5173
# Caddy admin: http://localhost:2019
```

To apply DB migrations inside the running stack:
```bash
docker-compose exec api npx prisma migrate dev
```

## What I'd do with more time

- **Nomad instead of raw Docker** — mirrors Brimble's actual production stack; gives
  scheduling, health-check integration, and drain semantics for free.
- **Consul for service discovery** — instead of hardcoding `host.docker.internal` in
  Caddy upstreams, Consul provides dynamic upstream registration with TTL health checks.
- **Vault for secrets** — env vars in docker-compose are fine for dev; production needs
  dynamic secret injection and rotation, especially for DB credentials.
- **S3/R2 for build artifact storage** — currently image tags are local to the host;
  distributing builds across nodes requires a registry (push to ECR, pull on any node).
- **Subdomain routing per deployment** — `<id>.brimble.dev` instead of `.localhost`
  requires wildcard DNS and a TLS cert, but gives customers a shareable URL instantly.
- **Bull Board** — mount `@bull-board/api` at `/admin/queues` for a visual job inspector.

## What I'd rip out

- The `_rb` key hack in rollback — a proper `containers` table that decouples containers
  from deployments 1:1 would eliminate the synthetic port-key gymnastics.
- `LogsService.streams` Map — for multi-instance deployments this is per-process memory.
  Replace with a Redis pub/sub channel per deploymentId so any API instance can fan out SSE.

## Known limitations

- **Single host only** — Docker socket is mounted directly; no multi-node scheduling.
- **No image registry** — images built by Railpack exist only on the Docker daemon that
  built them. Rollback only works if the daemon hasn't pruned the image.
- **SSE fan-out is in-process** — horizontal scaling of the API breaks log streaming
  unless backed by Redis pub/sub (see above).
- **Caddy Admin API `srv0`** — assumes a server named `srv0` exists in Caddy config;
  a fresh Caddy with only the static Caddyfile may need an initial `POST /config/apps/http`.
- **No auth** — all endpoints are public. Production needs at minimum a bearer token on
  the API and Caddy admin interface bound to a private network only.

---

## Build Cache

Railpack supports BuildKit-compatible local caching. Each deployment's cache is keyed by its URL slug (`<name>-<shortId>`) and stored in a named Docker volume (`railpack_cache`) mounted at `/cache` inside the API container.

- **First build (cold):** downloads base layers, installs dependencies — typically 1–3 min depending on language.
- **Subsequent builds (cached):** layer resolution skips already-built stages — typically 10–40s.
- Cache flags passed: `--cache-from type=local,src=/cache/<key> --cache-to type=local,dest=/cache/<key>,mode=max`
- `cacheHit` is determined by whether `/cache/<key>` exists **before** the build starts.
- Build duration is stored on the `Build` model as `durationMs` and shown in the UI with colour-coded timing.

---

## Container Metrics

After a deployment reaches `running` status, MetricsService opens a persistent Docker stats stream (`container.stats({ stream: true })`) and fans metrics out to any connected SSE clients.

**CPU formula (exact Docker formula):**
```
cpuDelta    = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage
systemDelta = cpu_stats.system_cpu_usage    - precpu_stats.system_cpu_usage
cpuPercent  = (cpuDelta / systemDelta) * numCpus * 100
```
This is non-trivial because Docker reports **cumulative** nanosecond counters; the delta between two consecutive stat frames gives the per-interval usage.

**SSE fan-out:** one `Subject<ContainerMetrics>` per deployment (same pattern as logs). Multiple browser tabs subscribe independently; the Docker stats stream is opened once and shared. `stopMetrics()` is called on container stop or redeploy.

**Endpoint:** `GET /deployments/:id/metrics` — raw SSE (not NestJS `@Sse`), returns 404 if deployment not `running`.

---

## Subdomain Routing

Each deployment gets a URL of the form `http://<name>-<shortId>.localhost` where `shortId = deploymentId.slice(0, 8)`.

**How `*.localhost` resolves:**
- Chrome and Firefox resolve `*.localhost` to `127.0.0.1` natively without `/etc/hosts` changes (per RFC 6761).
- Safari does not — add manually: `echo "127.0.0.1 <slug>.localhost" | sudo tee -a /etc/hosts`

**How Caddy routing works:**
- Caddy Admin API `PUT /id/{routeId}` updates existing routes in-place (redeployments).
- For new routes: `GET /config/apps/http/servers/<key>/routes` then `POST` (append to array) to register a `host` matcher.
- Routes are prepended (index 0) so they match before the catch-all `:80` route.

---

## GitHub Webhooks

Wire up auto-deploy on push in three steps:

1. Set `GITHUB_WEBHOOK_SECRET=<random>` in your API env.
2. In your GitHub repo: Settings → Webhooks → Add webhook.
   - Payload URL: `http://<your-server>:3001/webhooks/github`
   - Content type: `application/json`
   - Secret: same value as `GITHUB_WEBHOOK_SECRET`
   - Events: **Just the push event**
3. Push to the default branch — the API receives the webhook, finds any existing deployment for that repo URL, and triggers a redeploy. If none exists, it creates a new deployment automatically.

**HMAC verification:** every incoming webhook is verified with `crypto.timingSafeEqual` against the `X-Hub-Signature-256` header before any processing. Invalid signatures return 401.

---

## Production Delta

What would change moving this implementation to Brimble's actual production stack:

| This implementation | Production equivalent |
|---|---|
| `dockerode` + Docker socket | Nomad job submission via Nomad HTTP API |
| Caddy Admin API (dynamic routes) | Consul service registration + Consul-Template regenerating Caddy config |
| BullMQ + Redis | Nomad's built-in job scheduler |
| DB `PortAllocation` table | Nomad dynamic port allocation in job spec |
| `/var/run/docker.sock` | Nomad client API endpoint |
| `.env` secrets | Vault dynamic secrets injected at job runtime |
| Single-node Caddy | Multi-region Caddy fleet behind anycast |
