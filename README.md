# Simbus UI

> Control plane for a **site of [simbus](https://github.com/obsidia-systems/simbus) 0.3 field slaves** that a BMS (Ignition, Niagara, …) polls.

## Overview

**Simbus UI** is a local-only admin for virtual industrial field devices. Each device is a distroless Docker container: YAML language 2, Modbus TCP (and optional TLS / OPC UA / BACnet) on the field plane, HTTP control on `:8000` **inside `simbus-net` only**.

The browser talks only to the UI (`:4321`). The UI proxies `/points`, `/points/stream`, `/scenarios`, `/healthz`, `/readyz`, `/metrics`. Host port **8000 is never published** (host-dev binds loopback so `pnpm dev` can reach containers).

**Done when:** deploy builtin T&H → start → card shows live °C → Copy connection → run `heat-wave` → alarm on the card.

---

## Architecture

```
Browser ──HTTP 4321──▶ simbus-ui (Astro BFF + React app)
                           │
                           ├── SQLite  data/simbus.db  (devices, port_leases, drafts)
                           ├── Docker socket  (reconciler)
                           └── proxy :8000 on simbus-net  (never published to the LAN)
                                      │
                           simbus-net │
                           ┌───────────┴──────────┐
                           │  simbus-tnh-…        │  field :502 → host lease
                           │  SIMBUS_YAML_PATH    │  control :8000 internal
                           └─────────────────────┘
                                      ▲
                           Ignition / BMS (Modbus TCP on the host lease)
```

Three truth layers (do not mix):

| Layer           | Where                      | Examples                                             |
| --------------- | -------------------------- | ---------------------------------------------------- |
| Document        | `data/instances/{id}.yaml` | points, export, bundled scenarios                    |
| Runtime overlay | env + labels               | tick, seed, `SIMBUS_DEVICE_NAME`, `simbus.yaml-hash` |
| Publish         | SQLite `port_leases`       | host:5021 → container:502                            |

---

## Tech Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| Framework      | Astro 6.x (SSR Node adapter — BFF / dockerode) |
| UI             | React 19, TanStack Router, one QueryClient     |
| Styling        | Tailwind CSS 4.x + `src/styles/global.css`     |
| Data Fetching  | TanStack Query v5 + fleet SSE                  |
| Tables         | TanStack Table (points)                        |
| YAML editor    | CodeMirror 6                                   |
| ORM / Database | Drizzle ORM + better-sqlite3                   |
| Docker Client  | dockerode                                      |
| Testing        | Vitest + jsdom                                 |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- (Optional) [pnpm](https://pnpm.io/) and Node.js >= 22.12.0 for local development

### Docker Compose

```bash
docker compose up -d --build
```

Open <http://localhost:4321>. Sync presets from the simbus image, deploy **Generic T&H Sensor**.

The UI container mounts the named volume `simbus-data` at `/app/data` and passes `SIMBUS_INSTANCE_VOLUME=simbus-data` so device containers can read `instances/{id}.yaml` (Docker-from-Docker cannot bind `/app/data` as if it were a host path).

### Local development (`pnpm dev`)

```bash
pnpm install
pnpm dev
```

`SIMBUS_UI_MODE` defaults to `host`. Device HTTP is published to **`127.0.0.1` only** (not a Connect lease). Field Modbus still uses `port_leases`. Pull `ghcr.io/obsidia-systems/simbus:latest` so catalog sync and `simbus check` work.

---

## Environment Variables

| Variable                 | Default                                 | Description                                                                 |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------------------- |
| `SIMBUS_UI_MODE`         | `host`                                  | `docker` = `http://{container}:8000`; `host` = loopback control port        |
| `SIMBUS_IMAGE`           | `ghcr.io/obsidia-systems/simbus:latest` | Device image (catalog + runtime)                                            |
| `SIMBUS_INSTANCE_VOLUME` | unset                                   | Named volume for instance YAML (required when the UI itself runs in Docker) |
| `DATABASE_URL`           | `./data/simbus.db`                      | SQLite path                                                                 |
| `DOCKER_NETWORK`         | `simbus-net`                            | Bridge shared with device containers                                        |

---

## Project Structure

```
├── src/
│   ├── app/              # Single React tree (router, pages, QueryClient)
│   ├── db/               # Drizzle schema: devices, port_leases, templates (drafts)
│   ├── lib/              # docker, catalog, leases, proxy, reconciler
│   ├── pages/
│   │   ├── api/          # All mutations, reads, proxy, fleet SSE
│   │   ├── index.astro   # Mounts App
│   │   └── [...slug].astro
│   └── types/simbus.ts   # Control-plane DTOs (points, config, scenarios)
├── data/instances/       # Copy-on-write device YAML
├── data/catalog/          # Cached builtin/community from the image
├── docker-compose.yml
└── Dockerfile
```

---

## Scripts

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `pnpm dev`           | Start local dev server           |
| `pnpm build`         | Production build to `./dist/`    |
| `pnpm preview`       | Preview production build locally |
| `pnpm test`          | Run Vitest test suite            |
| `pnpm test:coverage` | Run tests with coverage report   |
| `pnpm lint`          | Run ESLint                       |
| `pnpm lint:fix`      | Run ESLint with auto-fix         |
| `pnpm format`        | Format with Prettier             |
| `pnpm type-check`    | Run Astro + TypeScript checks    |

---

## License

MIT
