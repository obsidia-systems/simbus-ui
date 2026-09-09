# simbus-ui — 0.3 control plane

Local-only BFF for a site of simbus **0.3** field slaves. Named labs, plant view, and session scenarios are **P1**.

## Dual plane

- **Control HTTP `:8000`:** `simbus-net` only. UI proxies `/status`, `/config`, `/points`, `/points/stream`, `/faults`, `/scenarios`, `/simulation`, `/healthz`, `/readyz`, `/metrics`.
- **Field TCP/UDP:** IANA inside the container. Host mappings live in `port_leases`, not in YAML.
- **Host-dev exception:** bind `:8000` to `127.0.0.1:{controlHostPort}` so `pnpm dev` can proxy. Never show that port in Connect.

## Boot

File-only: `SIMBUS_YAML_PATH`. Distroless, UID **65532**, read-only, `cap_drop ALL` + `NET_BIND_SERVICE`, 128 MiB, pids 64. Labels `simbus.managed`, `simbus.device-id`, `simbus.yaml-hash`.

Catalog: `docker create` + `getArchive /app/devices`. Validate: `docker run --rm IMAGE check …`.

## Reconciler

SQLite `desired_state` vs `inspect`. Recreate on hash mismatch or orphan.

## UI

One React tree (`src/app`) + TanStack Router + one QueryClient. Mutations are API routes. Live cards use `/api/fleet/stream`.
