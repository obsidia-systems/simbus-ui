# Simbus UI

> Web control plane for managing multiple [simbus](https://github.com/obsidia-systems/simbus) virtual Modbus TCP field devices.

## Overview

**Simbus UI** is a local-only, dark-themed admin interface built with Astro and React. It creates, monitors, and controls virtual industrial field devices (sensors, UPS, PDUs, CRACs, etc.) running as individual Docker containers. Each device exposes a Modbus TCP server and a REST API; the UI proxies requests and streams live register data via SSE.

**Key use cases:**

- Build SCADA/HMI labs without physical hardware
- Test alarm and notification pipelines
- Train operators on realistic telemetry
- Validate tag configurations in Ignition, Wonderware, or FactoryTalk

---

## Architecture

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│   Browser   │──────▶  simbus-ui :4321     │──────▶  Docker Socket      │
│             │◀─────│  (Astro + Node SSR)  │      │  (container mgmt)   │
└─────────────┘      └──────────────────────┘      └─────────────────────┘
                              │
                              ▼
                     ┌──────────────────────┐
                     │  SQLite (Drizzle)    │
                     │  ./data/simbus.db    │
                     └──────────────────────┘

Each device is an isolated Docker container on the shared `simbus-net` bridge:

┌─────────────────────────────────────────────────────────────┐
│                        simbus-net                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ simbus-th-1 │  │ simbus-ups-1│  │ simbus-pdu-1│  ...    │
│  │ Modbus :502 │  │ Modbus :502 │  │ Modbus :502 │         │
│  │ REST  :8000 │  │ REST  :8000 │  │ REST  :8000 │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                                            |
| -------------- | ----------------------------------------------------- |
| Framework      | Astro 6.x (SSR, Node standalone adapter)              |
| UI Components  | React 19 (Astro islands)                              |
| Styling        | Tailwind CSS 4.x + custom dark theme                  |
| Data Fetching  | TanStack Query v5                                     |
| Forms          | React Hook Form + Zod                                 |
| ORM / Database | Drizzle ORM + better-sqlite3                          |
| Docker Client  | dockerode                                             |
| Testing        | Vitest + jsdom + Testing Library                      |
| Linting        | ESLint 9 flat config (TypeScript, React, Astro, a11y) |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- (Optional) [pnpm](https://pnpm.io/) and Node.js >= 22.12.0 if you want to develop locally

---

### Docker Run (Fastest — one command)

Copy-paste the block below. It creates the shared `simbus-net` bridge (if it does not exist) and starts the UI on <http://localhost:4321>.

```bash
# 1. Create the shared network for simbus device containers
docker network inspect simbus-net >/dev/null 2>&1 || docker network create simbus-net

# 2. Run simbus-ui
docker run -d \
  --name simbus-ui \
  --network simbus-net \
  -p 4321:4321 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v simbus-ui-data:/app/data \
  -e SIMBUS_UI_MODE=docker \
  -e DOCKER_NETWORK=simbus-net \
  ghcr.io/obsidia-systems/simbus-ui:latest
```

**What each flag does**

| Flag                           | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `-d`                           | Run in the background                                       |
| `--name simbus-ui`             | Easy reference for `docker stop` / `docker logs`            |
| `--network simbus-net`         | Shared bridge so the UI can reach device containers by name |
| `-p 4321:4321`                 | Expose the web UI on your host                              |
| `-v /var/run/docker.sock:...`  | Let the UI create/manage device containers                  |
| `-v simbus-ui-data:/app/data`  | Persist the SQLite database across restarts                 |
| `-e SIMBUS_UI_MODE=docker`     | Internal DNS resolution via container names                 |
| `-e DOCKER_NETWORK=simbus-net` | Network that new device containers join                     |

**Open your browser** → <http://localhost:4321> → click **New Device** to launch your first virtual field device.

**Stop / remove later**

```bash
docker stop simbus-ui && docker rm simbus-ui
# Data is kept in the named volume 'simbus-ui-data' unless you also:
docker volume rm simbus-ui-data
```

---

### Docker Compose (Recommended for persistent labs)

Save this as `compose.yml` (or clone the repo and use the built-in `docker-compose.yml`):

```yaml
services:
  simbus-ui:
    image: ghcr.io/obsidia-systems/simbus-ui:latest
    ports:
      - '4321:4321'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - simbus-ui-data:/app/data
      - simbus-configs:/app/configs
    environment:
      SIMBUS_UI_MODE: docker
      DOCKER_NETWORK: simbus-net
    networks:
      - simbus-net
    restart: unless-stopped

volumes:
  simbus-ui-data:
  simbus-configs:

networks:
  simbus-net:
    name: simbus-net
    driver: bridge
```

Start it:

```bash
docker compose up -d
```

---

### Local Development

Only needed if you want to modify the source code.

```bash
# Install dependencies
pnpm install

# Start dev server (runs on http://localhost:4321)
pnpm dev
```

> **Note:** In local dev mode (`SIMBUS_UI_MODE=host`), device containers must expose their REST API port to the host so the UI can reach them. Use the **Expose REST API port** option in the device creation wizard.

---

## Environment Variables

| Variable         | Default                                 | Description                                                                                              |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `SIMBUS_UI_MODE` | `host`                                  | `host` = reach devices via `localhost:{hostApiPort}`; `docker` = reach by container name on `simbus-net` |
| `SIMBUS_IMAGE`   | `ghcr.io/obsidia-systems/simbus:latest` | Docker image used for device containers                                                                  |
| `DATABASE_URL`   | `./data/simbus.db`                      | SQLite database file path                                                                                |
| `DOCKER_NETWORK` | `simbus-net`                            | Bridge network name for device containers                                                                |

---

## Project Structure

```
├── src/
│   ├── actions/          # Astro Actions (mutations: create device, inject fault, etc.)
│   ├── components/       # React islands (DeviceGrid, RegisterTable, FaultPanel, etc.)
│   ├── db/
│   │   ├── schema.ts     # Drizzle schema (devices, templates)
│   │   ├── migrations/   # SQL migrations
│   │   └── index.ts      # DB client + auto-migrate
│   ├── layouts/          # Astro layouts
│   ├── lib/
│   │   ├── docker.ts     # Container lifecycle (create, start, stop, remove)
│   │   ├── proxy.ts      # Proxy to simbus device REST APIs
│   │   ├── ports.ts      # Host port availability validation
│   │   └── device-types.ts  # Built-in device type registry
│   ├── pages/
│   │   ├── api/          # API routes (reads, SSE, logs)
│   │   ├── index.astro   # Dashboard
│   │   ├── devices/
│   │   │   ├── new.astro      # Device creation wizard
│   │   │   └── [id].astro     # Device detail (registers, faults, logs)
│   │   └── templates.astro    # Template library
│   ├── styles/
│   │   └── global.css    # Tailwind + custom dark theme
│   └── types/
│       └── simbus.ts     # Types derived from simbus OpenAPI spec
├── data/                 # SQLite database + custom YAML configs
├── docs/
│   ├── idea.md           # Full project vision & roadmap
│   └── implementation-plan.md  # Detailed technical plan
├── docker-compose.yml
├── Dockerfile
└── package.json
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
