# Agent Guide — simbus-ui

> Quick reference for AI agents working on this codebase.

---

## Stack & Versions

| Technology    | Version                                    |
| ------------- | ------------------------------------------ |
| Astro         | 6.x (SSR Node adapter as BFF)              |
| React         | 19 (single client tree, TanStack Router)   |
| Tailwind CSS  | 4.x                                        |
| TypeScript    | 6.x (strict, verbatimModuleSyntax)         |
| Node.js       | >= 22.12.0                                 |
| SQLite        | better-sqlite3 (WAL mode, foreign keys ON) |
| ORM           | Drizzle ORM                                |
| Docker client | dockerode                                  |
| simbus engine | **0.3.0** (`ghcr.io/obsidia-systems/simbus:0.3.0`) |

---

## Commands

```bash
# Development
pnpm dev              # localhost:4321
pnpm test             # vitest run
pnpm test:watch       # vitest (interactive)
pnpm test:coverage    # coverage report

# Quality checks
pnpm lint
pnpm lint:fix
pnpm format
pnpm type-check       # astro check

# Production
pnpm build
pnpm preview
```

---

## Code Conventions

### Imports

ESLint sorts imports automatically via `simple-import-sort`. Order:

1. Side effects (`import './polyfills'`)
2. Node built-ins (`node:fs`)
3. Astro ecosystem (`astro:actions`, `@astrojs/*`)
4. External packages (`react`, `zod`)
5. Internal alias (`@/db`, `@/lib/docker`)
6. Relative imports (`./RegisterTable`)
7. Styles (`*.css`)

Use `import type` for type-only imports (enforced by `@typescript-eslint/consistent-type-imports`).

### Server Interface Pattern

| Operation Type                               | Use                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| **Mutations** (POST, create, update, delete) | Astro API routes (`src/pages/api/**/*.ts`) + TanStack Query `useMutation` |
| **Reads** (GET, list, fetch)                 | Astro API Routes — consumed by TanStack Query                             |
| **Streams** (SSE, logs)                      | Astro API Routes (`/api/devices/[id]/[...path]`, `/api/fleet/stream`)     |

Do **not** add Astro Actions. The control plane is SSE + proxy, which Actions cannot cover.

### Zod Validation

Validate request bodies in API routes with Zod before calling `src/lib/devices.ts`.

### Docker Container Naming

```
simbus-{preset-short}-{slugified-name}
# e.g. simbus-tnh-sensor-hot-aisle-01
```

Required labels on every created container:

- `simbus.managed = "true"`
- `simbus.device-id = <uuid>`
- `simbus.yaml-hash = <sha256 of instance YAML>`

Boot is **file-only**: `SIMBUS_YAML_PATH` points at the bind-mounted instance YAML. Never set `SIMBUS_DEVICE_TYPE`.

---

## Key Architectural Decisions

1. **One container per device.** Distroless simbus 0.3, UID 65532, read-only rootfs. Field plane (Modbus 502, optional TLS/UA/BACnet) may be published via `port_leases`. Control HTTP `:8000` is **never** published to the LAN.

2. **Three truth layers.** Instance YAML on disk (`data/instances/{id}.yaml`); runtime overlay via env (`SIMBUS_TICK_INTERVAL`, seed, name); host publish in SQLite `port_leases`.

3. **Proxy pattern.** The browser never talks to `:8000`. `src/lib/proxy.ts` resolves `http://{container}:8000` in docker mode, or `http://127.0.0.1:{controlHostPort}` in host mode (loopback only).

4. **Canonical live data is `/points`.** Proxy `GET/PATCH /points` and `/points/stream`. Fleet SSE is `/api/fleet/stream`. Registers remain as a Modbus view (HR{n+1}).

5. **Reconciler.** Desired `running|stopped` in SQLite vs `inspect`. Recreate on yaml-hash mismatch or orphan (container deleted outside the UI).

6. **No authentication.** Local-only by design. Never expose to public networks.

---

## Testing

- Framework: **Vitest** with `jsdom` environment.
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom`.
- Mocks: Use `vi.mock()` for module-level mocks. Vitest hoists `vi.mock` calls automatically.
- Coverage: `v8` provider, includes `src/**/*.{ts,tsx}`.

When writing tests for modules that import `@/db` or `@/lib/docker`, mock them at the top of the test file before importing the module under test.

---

## Common Pitfalls

- **`process.env` in SSR vs client:** `process.env` is available server-side (API routes). In Vite-bundled client code, only `import.meta.env.*` works. `src/lib/runtime.ts` reads `process.env` at runtime to avoid Vite replacement.
- **Docker-from-Docker binds:** Host paths in `Binds` are daemon paths. In compose, mount the named volume `simbus-data` at `/app/data` and set `SIMBUS_INSTANCE_VOLUME=simbus-data`.
- **Port collisions:** Allocate field ports via `src/lib/leases.ts` (5020–5999). Never publish 8000 except host-mode loopback.
- **Distroless:** No `docker exec sh`. Logs come from the Docker API.
- **Pinned engine:** Device containers and catalog sync use `DEFAULT_SIMBUS_IMAGE` (`simbus:0.3.0`). Do not default to `:latest`. Bump the pin only when this UI is updated for a new engine contract.
- **AbortSignal.timeout:** Used in proxy functions for 5s fetch timeouts. SSE has no timeout.

---

## Related Repositories

- [`obsidia-systems/simbus`](https://github.com/obsidia-systems/simbus) — Rust engine 0.3 (Modbus TCP slave, HTTP control plane, YAML language 2)
