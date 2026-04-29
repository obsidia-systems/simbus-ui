# Agent Guide — simbus-ui

> Quick reference for AI agents working on this codebase.

---

## Stack & Versions

| Technology    | Version                                    |
| ------------- | ------------------------------------------ |
| Astro         | 6.x (SSR, Node standalone adapter)         |
| React         | 19 (islands architecture)                  |
| Tailwind CSS  | 4.x                                        |
| TypeScript    | 6.x (strict, verbatimModuleSyntax)         |
| Node.js       | >= 22.12.0                                 |
| SQLite        | better-sqlite3 (WAL mode, foreign keys ON) |
| ORM           | Drizzle ORM                                |
| Docker client | dockerode                                  |

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

| Operation Type                               | Use                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Mutations** (POST, create, update, delete) | Astro Actions (`src/actions/index.ts`) — type-safe, Zod-validated, returns `{ data, error }` |
| **Reads** (GET, list, fetch)                 | Astro API Routes (`src/pages/api/**/*.ts`) — consumed by TanStack Query                      |
| **Streams** (SSE, logs)                      | Astro API Routes — incompatible with Actions model                                           |

### Zod Validation

Every Astro Action must define an `input` schema. Example:

```typescript
import { defineAction } from 'astro:actions'
import { z } from 'zod'

export const server = {
  devices: {
    create: defineAction({
      input: z.object({
        name: z.string().min(1).max(64),
        type: z.string().min(1),
        hostModbusPort: z.number().int().min(1).max(65535).nullish(),
      }),
      handler: async (input) => {
        /* ... */
      },
    }),
  },
}
```

### Docker Container Naming

```
simbus-{type-short}-{slugified-name}
# e.g. simbus-tnh-hot-aisle-01, simbus-ups-rack-a
```

Required labels on every created container:

- `simbus.managed = "true"`
- `simbus.device-id = <uuid>`
- `simbus.device-type = <type>`

---

## Key Architectural Decisions

1. **One container per device.** Each simbus device is an isolated Docker container with its own Modbus TCP port. This mirrors real hardware where each device has a unique IP/port.

2. **SQLite persists configs independently of Docker state.** If a container is removed externally, the config record remains and the device can be re-created.

3. **Proxy pattern for device APIs.** The UI never talks directly to device containers from the browser. All requests go through `src/lib/proxy.ts` (server-side) which resolves the correct URL based on `SIMBUS_UI_MODE`.

4. **SSE for live registers.** Device containers expose `/registers/stream`. The UI proxies this via `/api/devices/[id]/registers/stream` and the React hook `useRegisterStream` reconnects automatically.

5. **No authentication.** Local-only by design. Never expose to public networks.

---

## Testing

- Framework: **Vitest** with `jsdom` environment.
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom`.
- Mocks: Use `vi.mock()` for module-level mocks. Vitest hoists `vi.mock` calls automatically.
- Coverage: `v8` provider, includes `src/**/*.{ts,tsx}`.

When writing tests for modules that import `@/db` or `@/lib/docker`, mock them at the top of the test file before importing the module under test.

---

## Common Pitfalls

- **`process.env` in SSR vs client:** `process.env` is available server-side (API routes, actions). In Vite-bundled client code, only `import.meta.env.*` works. `src/lib/docker.ts` reads `process.env` at runtime to avoid Vite replacement.
- **Docker socket permissions:** The UI needs access to `/var/run/docker.sock`. In Docker mode, mount the socket as a volume.
- **Port collisions:** Always validate `hostModbusPort` and `hostApiPort` against existing Docker containers before creating a device. See `src/lib/ports.ts`.
- **AbortSignal.timeout:** Used in proxy functions for 5s fetch timeouts. Available in Node 16.14+.

---

## Related Repositories

- [`obsidia-systems/simbus`](https://github.com/obsidia-systems/simbus) — Core Python engine (Modbus TCP server, REST API, simulation engine)
