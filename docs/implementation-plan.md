# simbus-ui — Scope & Implementation Plan

> Local-only admin interface to create, monitor, and control simbus virtual field devices
> running as individual Docker containers.

---

## 1. Concept

Each **simbus device is an isolated Docker container**. The UI is the control plane:
it creates containers, manages their lifecycle, and communicates with each device's
built-in REST API to display live register data and inject simulation commands.

No login. No cloud. 100% local — designed for labs, POCs, and SCADA integration testing.

---

## 2. Architecture

```
Browser
  │
  ▼
simbus-ui (Astro + Node SSR)  :3000
  │
  ├── /var/run/docker.sock  (dockerode)
  │       │
  │       ├── [simbus-net] simbus-tnh-01   Modbus TCP: container:502   [host:XXXX optional]
  │       │                                REST API:   container:8000  [host:XXXX optional]
  │       │
  │       ├── [simbus-net] simbus-ups-01   Modbus TCP: container:502   [host:XXXX optional]
  │       │                                REST API:   container:8000  [host:XXXX optional]
  │       │
  │       └── [simbus-net] simbus-pdu-01   Modbus TCP: container:502   [host:XXXX optional]
  │                                        REST API:   container:8000  [host:XXXX optional]
  │
  └── SQLite (Drizzle)   — device configs, templates, port registry
```

**Key design decisions:**

- Every simbus container exposes its REST API on **internal port 8000** (default).
  The UI reaches it via the `simbus-net` Docker network when running containerized,
  or via a mapped host port in local dev mode.
- **Modbus TCP port mapping to host is optional** — only needed when an external
  Modbus client (Ignition, Wonderware, etc.) needs to connect to the device directly.
- **REST API port mapping to host is optional** — the UI accesses it internally.
- The UI labels every container it creates with `simbus.managed=true` so it can
  distinguish its own containers from unrelated ones.
- SQLite persists device configurations independently of Docker state. If a container
  is removed externally, the config record remains and the device can be re-created.

---

## 3. Tech Stack

| Layer                | Technology                  | Notes                               |
| -------------------- | --------------------------- | ----------------------------------- |
| Framework            | Astro 6 (SSR, Node adapter) | Already configured                  |
| UI components        | React 19 (Astro islands)    | Already configured                  |
| Styling              | Tailwind CSS 4              | Already configured                  |
| Component library    | shadcn/ui                   | TW4-compatible branch               |
| Client data fetching | TanStack Query v5           | Polling + SSE management            |
| Form handling        | React Hook Form + Zod       | Device creation wizard              |
| Docker client        | dockerode                   | Server-side only, in API routes     |
| ORM                  | Drizzle ORM                 | Server-side only                    |
| Database             | better-sqlite3 (SQLite)     | Local file, e.g. `./data/simbus.db` |
| Live register data   | SSE (`/registers/stream`)   | Proxied from each device container  |

---

## 4. Data Model (SQLite)

```typescript
// schema.ts

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(), // uuid
  name: text('name').notNull(),
  type: text('type').notNull(), // generic-tnh-sensor | custom | ...
  dockerContainerId: text('docker_container_id'), // set after container creation
  dockerContainerName: text('docker_container_name').notNull().unique(),
  // --- internal ports (inside container) ---
  internalModbusPort: integer('internal_modbus_port').notNull().default(502),
  internalApiPort: integer('internal_api_port').notNull().default(8000),
  // --- optional host-side port mapping ---
  hostModbusPort: integer('host_modbus_port'), // null = not exposed
  hostApiPort: integer('host_api_port'), // null = not exposed
  // --- simulation config ---
  tickInterval: real('tick_interval').notNull().default(1.0),
  seed: integer('seed'),
  // --- custom device ---
  yamlConfig: text('yaml_config'), // null for built-in types
  // --- meta ---
  createdAt: integer('created_at').notNull(), // epoch ms
})
```

---

## 5. Docker Strategy

### Container naming

```
simbus-{type-short}-{name}
  e.g.: simbus-tnh-hot-aisle-01
        simbus-ups-rack-a
```

### Required labels on every created container

```
simbus.managed     = "true"
simbus.device-id   = "<uuid>"
simbus.device-type = "generic-tnh-sensor"
```

### Docker network

All simbus containers are attached to a dedicated bridge network: **`simbus-net`**.
The UI creates it on first run if it does not exist.

### Internal API URL per device

```
// When simbus-ui runs in Docker on the same network:
http://{dockerContainerName}:8000

// When simbus-ui runs on the host (dev mode):
http://localhost:{hostApiPort}   ← requires hostApiPort to be set
```

The `internalApiUrl` is resolved at runtime based on whether `hostApiPort` is set.

### docker run equivalent

```bash
docker run -d \
  --name   simbus-tnh-hot-aisle-01 \
  --network simbus-net \
  --label  simbus.managed=true \
  --label  simbus.device-id=<uuid> \
  --label  simbus.device-type=generic-tnh-sensor \
  -e SIMBUS_DEVICE_TYPE=generic-tnh-sensor \
  -e SIMBUS_MODBUS_PORT=502 \
  -e SIMBUS_API_PORT=8000 \
  -e SIMBUS_TICK_INTERVAL=1.0 \
  [-p <hostModbusPort>:502]   \  # optional
  [-p <hostApiPort>:8000]     \  # optional
  ghcr.io/obsidia-systems/simbus:latest
```

---

## 6. Server Interface — Actions + API Routes

Astro Actions handle all **mutations** (POST-only, type-safe, Zod-validated, `{ data, error }`
returned to the client). Astro API Routes handle **reads** (TanStack Query polling) and
**streams** (SSE, Docker logs) which are incompatible with the Actions model.

### 6a. Astro Actions (`src/actions/index.ts`)

```typescript
// Mutations — called from React components via:
// const { data, error } = await actions.devices.create(input)

actions/
  devices/
    create        input: { name, type, internalModbusPort, internalApiPort,
                           hostModbusPort?, hostApiPort?, tickInterval, seed?, yamlConfig? }
    remove        input: { id }
    start         input: { id }
    stop          input: { id }
  registers/
    overrideHolding   input: { deviceId, address, value?, real_value? }
    overrideInput     input: { deviceId, address, value?, real_value? }
    overrideCoil      input: { deviceId, address, value: boolean }
    overrideDiscrete  input: { deviceId, address, value: boolean }
  faults/
    inject        input: { deviceId, fault_type, register_name?, value?, duration_s? }
    clear         input: { deviceId }
  simulation/
    patch         input: { deviceId, tick_interval }
    reset         input: { deviceId }
```

### 6b. API Routes (`src/pages/api/`) — reads and streams

```
GET  /api/devices                       List devices (DB + Docker state merged)
GET  /api/devices/[id]/status           Proxy → GET /status
GET  /api/devices/[id]/config           Proxy → GET /config
GET  /api/devices/[id]/registers        Proxy → GET /registers
GET  /api/devices/[id]/registers/stream Proxy SSE → GET /registers/stream
GET  /api/devices/[id]/faults           Proxy → GET /faults
GET  /api/devices/[id]/logs             docker logs (last N lines, or stream)
```

---

## 7. Pages & Components

### Pages

| Route           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `/`             | Dashboard — grid of all device cards with live status |
| `/devices/new`  | Device creation wizard (3 steps)                      |
| `/devices/[id]` | Device detail: registers, faults, simulation controls |

### Components

```
src/components/
  devices/
    DeviceGrid.tsx          Grid layout, fetches device list
    DeviceCard.tsx          Card: name, type, status badge, port, quick controls
    StatusBadge.tsx         running / stopped / error / creating
    DeviceActions.tsx       Start / Stop / Remove buttons with confirm
  wizard/
    DeviceWizard.tsx        Multi-step form shell
    StepType.tsx            Step 1: pick built-in type or custom YAML
    StepConfig.tsx          Step 2: name, ports, tick interval, seed
    StepPorts.tsx           Step 3: optional host port mapping
    StepReview.tsx          Step 4: summary before create
  registers/
    RegisterTable.tsx       Full register table (holding, input, coils, discrete tabs)
    RegisterRow.tsx         Address | Name | Raw | Scaled | Unit | Override input
  faults/
    FaultPanel.tsx          Fault type selector, register target, duration
    FaultList.tsx           Active faults with remaining time + clear button
  simulation/
    SimulationControls.tsx  Tick interval input + Reset button
  logs/
    LogsViewer.tsx          Container log tail (polling)
```

---

## 8. Built-in Device Types

Sourced from `ghcr.io/obsidia-systems/simbus` — passed as `SIMBUS_DEVICE_TYPE`:

| Key                    | Label        | Default Modbus Port |
| ---------------------- | ------------ | ------------------- |
| `generic-tnh-sensor`   | T&H Sensor   | 502                 |
| `generic-ups`          | UPS          | 502                 |
| `generic-pdu`          | PDU          | 502                 |
| `generic-crac`         | CRAC         | 502                 |
| `generic-power-meter`  | Power Meter  | 502                 |
| `generic-leak-sensor`  | Leak Sensor  | 502                 |
| `generic-door-contact` | Door Contact | 502                 |

The UI suggests the default Modbus port per type but lets the user override it.
The REST API always runs on internal port 8000 regardless of device type.

---

## 9. Implementation Phases

### Phase 1 — Foundation

> Goal: containers can be created, listed, started, stopped, and removed.

- [ ] Install dependencies: `dockerode`, `@types/dockerode`, `drizzle-orm`,
      `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit`,
      `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`
- [ ] Configure Drizzle (`drizzle.config.ts`, `src/db/schema.ts`, `src/db/index.ts`)
- [ ] Run initial migration, create `./data/simbus.db`
- [ ] Docker utility (`src/lib/docker.ts`): ensure `simbus-net` network, list/create/start/stop/remove containers
- [ ] API route: `GET /api/devices` (list, for TanStack Query)
- [ ] Actions: `devices.create`, `devices.remove`, `devices.start`, `devices.stop`
- [ ] Dashboard page with device grid (status from Docker only, no simbus API yet)
- [ ] Device creation wizard (built-in types, no custom YAML)

### Phase 2 — Live Device Data

> Goal: register table with live data, SSE stream.

- [ ] API routes: `/status`, `/config`, `/registers`, `/registers/stream` (SSE proxy)
- [ ] `DeviceCard` shows live `/status` data (simulation state, modbus server state)
- [ ] Device detail page with register table
- [ ] SSE streaming via `/api/devices/[id]/registers/stream` proxied to browser
- [ ] Actions: `registers.overrideHolding`, `overrideInput`, `overrideCoil`, `overrideDiscrete`

### Phase 3 — Simulation Controls

> Goal: fault injection and simulation management.

- [ ] API route: `/api/devices/[id]/faults` (GET — TanStack Query polling)
- [ ] Actions: `faults.inject`, `faults.clear`
- [ ] Actions: `simulation.patch`, `simulation.reset`
- [ ] API route: `/api/devices/[id]/logs` + `LogsViewer` component

### Phase 4 — Custom Devices & Templates

> Goal: custom YAML device definitions, saved templates.

- [ ] Custom YAML upload in creation wizard (`SIMBUS_YAML_PATH` via volume mount)
- [ ] Save device config as reusable template in SQLite
- [ ] Templates library on dashboard — one-click deploy from template

---

## 10. Development Setup

### Running simbus-ui locally (dev mode)

```bash
# simbus-ui runs on host at :3000
pnpm dev

# Containers must expose their REST API port to the host
# → set hostApiPort when creating a device, or use the default auto-assign
```

### Running everything in Docker (lab mode)

```yaml
# docker-compose.yml (in this repo)
services:
  simbus-ui:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
    environment:
      - SIMBUS_UI_MODE=docker # tells the UI to use container-name URLs
    networks:
      - simbus-net

networks:
  simbus-net:
    external: true # created by the UI on first run
```

### Environment variables

| Variable         | Default                                 | Description                                             |
| ---------------- | --------------------------------------- | ------------------------------------------------------- |
| `SIMBUS_UI_MODE` | `host`                                  | `host` = use hostApiPort, `docker` = use container name |
| `SIMBUS_IMAGE`   | `ghcr.io/obsidia-systems/simbus:latest` | Docker image for simbus containers                      |
| `DATABASE_URL`   | `./data/simbus.db`                      | SQLite database path                                    |
| `DOCKER_NETWORK` | `simbus-net`                            | Bridge network name                                     |

---

## 11. Non-Goals (v0.1–v0.3)

- No authentication or multi-user support (local-only by design)
- No Prometheus metrics or observability dashboards
- No scenario runner UI (the simbus REST API supports scenarios; UI comes later)
- No real-time register charts / gauge widgets (v0.4+)
- No BACnet/IP or SNMP protocol support (simbus roadmap item)
- Not a replacement for the simbus CLI — CLI and UI are complementary
