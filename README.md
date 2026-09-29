# LordSU

Production-oriented on-demand Android root-manager builder.

LordSU lets a user configure a branded manager in the browser and receive a freshly built, signed and verified APK from an approved KernelSU or KernelSU Next source revision.

## Architecture

```
Browser → Next.js → Express API → BullMQ/Redis → isolated Android worker
                                              ↓
                                   signed + verified APK
                                              ↓
                                  persistent artifact volume
```

The worker is constrained to approved backends and configuration inputs. It does not expose arbitrary shell commands or arbitrary source execution.

## Development

Start the local stack:

```bash
docker compose up -d --build
```

Open `http://localhost:3000`.

The development stack persists Redis, APK artifacts, Gradle cache, source cache and uploaded icons in named Docker volumes.

Do not use `docker compose down -v` unless you intentionally want to delete all persistent caches and artifacts.

## Production

1. Copy `.env.example` to `.env`.
2. Set a strong `REDIS_PASSWORD`.
3. Set `CORS_ORIGIN` to the public web origin.
4. Set `NEXT_PUBLIC_API_URL` to the public API origin.
5. Put the web/API endpoints behind HTTPS at your reverse proxy or load balancer.
6. Keep Redis private; do not publish port 6379.

Build and start:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

Check:

```bash
curl http://localhost:4000/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f worker
```

For a public deployment, TLS should terminate at a reverse proxy/load balancer and only the web/API ports should be exposed. Redis should remain on the private Docker network.

## Build lifecycle

```
queued → running → ready
                  ↘ failed
                  ↘ cancelled
```

Build state is stored in Redis for 24 hours. APK artifacts are stored in the `build-artifacts` volume and are cleaned up automatically after the configured TTL. Browser refresh restores the active build from its persisted build ID.

Active builds can be cancelled. Cancellation terminates the isolated builder process and removes its temporary workspace.

## Security controls

- Input validation with Zod.
- Approved backend allowlist.
- Package-name validation.
- PNG/WebP magic-byte validation.
- 10 MB upload limit and multipart field limits.
- Redis-backed per-IP build/status rate limiting.
- Queue-depth protection.
- Security response headers.
- Strict download path traversal protection.
- Automatic upload/artifact cleanup.
- Graceful API/worker shutdown.
- Redis authentication in the production Compose stack.
- No public Redis port.
- Production containers run as non-root where practical.

Multer is pinned to the current patched 2.3.x line.

## Operational notes

The first Android build is cold and can be significantly slower than subsequent builds. Warm Gradle/source caches are persisted between builds. Worker concurrency defaults to 1 because Android builds are CPU and memory intensive.

Before internet-facing deployment, put the application behind HTTPS and add authentication/quotas if arbitrary public users will be allowed to consume build capacity.
