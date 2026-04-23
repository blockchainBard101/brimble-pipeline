# brimble-pipeline

A mini-PaaS deployment pipeline. Submit a Git URL, the system builds a Docker image via Railpack, runs it as a container, and Caddy reverse-proxies a URL to it. Logs stream live to the UI over SSE.

## Quick start

```bash
cp .env.example .env
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Web UI  | http://localhost:5173 |
| API     | http://localhost:3001 |
| Caddy   | http://localhost:80 |
| DB      | localhost:5432 |

## Local dev (without Docker)

```bash
npm install
# terminal 1
cd apps/api && npx prisma migrate dev && npm run dev
# terminal 2
cd apps/web && npm run dev
```

## Testing with sample-app

```bash
cd infra/sample-app && npm install && npm start
```
