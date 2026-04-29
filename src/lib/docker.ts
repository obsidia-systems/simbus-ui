import fs from 'node:fs/promises'
import path from 'node:path'

import Dockerode from 'dockerode'

import type { Device } from '@/db/schema'

const SIMBUS_IMAGE = process.env.SIMBUS_IMAGE ?? 'ghcr.io/obsidia-systems/simbus:latest'
const DOCKER_NETWORK = process.env.DOCKER_NETWORK ?? 'simbus-net'

export const docker = new Dockerode()

// --- Network ---

export async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({ filters: { name: [DOCKER_NETWORK] } })
  const exists = networks.some((n) => n.Name === DOCKER_NETWORK)
  if (!exists) {
    await docker.createNetwork({ Name: DOCKER_NETWORK, Driver: 'bridge' })
  }
}

// --- Custom YAML helpers ---

export async function writeDeviceYaml(deviceId: string, yamlConfig: string): Promise<void> {
  await fs.mkdir('/app/configs', { recursive: true })
  await fs.writeFile(path.join('/app/configs', `${deviceId}.yaml`), yamlConfig, 'utf8')
}

// --- Container lifecycle ---

export interface CreateContainerOptions {
  id: string
  name: string
  type: string
  containerName: string
  internalModbusPort: number
  internalApiPort: number
  hostModbusPort?: number | null
  hostApiPort?: number | null
  tickInterval: number
  seed?: number | null
  yamlConfig?: string | null
}

export async function createContainer(opts: CreateContainerOptions): Promise<string> {
  await ensureNetwork()

  const isCustom = opts.type === 'custom' && !!opts.yamlConfig

  const portBindings: Record<string, { HostPort: string }[]> = {}
  const exposedPorts: Record<string, object> = {}

  if (opts.hostModbusPort) {
    const key = `${opts.internalModbusPort}/tcp`
    exposedPorts[key] = {}
    portBindings[key] = [{ HostPort: String(opts.hostModbusPort) }]
  }

  if (opts.hostApiPort) {
    const key = `${opts.internalApiPort}/tcp`
    exposedPorts[key] = {}
    portBindings[key] = [{ HostPort: String(opts.hostApiPort) }]
  }

  const env: string[] = [
    `SIMBUS_TICK_INTERVAL=${opts.tickInterval}`,
    `SIMBUS_CORS_ORIGINS=["*"]`,
    ...(opts.seed != null ? [`SIMBUS_SEED=${opts.seed}`] : []),
  ]

  const binds: string[] = []

  if (isCustom) {
    // Write the YAML content (from the DB) into the shared named volume so the
    // device container can read it via SIMBUS_YAML_PATH. The named volume
    // `simbus-configs` is mounted in simbus-ui at /app/configs and referenced
    // by name in the device container — no host path needed.
    await writeDeviceYaml(opts.id, opts.yamlConfig!)

    binds.push(`simbus-configs:/app/configs:ro`)
    env.push(`SIMBUS_YAML_PATH=/app/configs/${opts.id}.yaml`)
  } else {
    env.push(`SIMBUS_DEVICE_TYPE=${opts.type}`)
    env.push(`SIMBUS_MODBUS_PORT=${opts.internalModbusPort}`)
    env.push(`SIMBUS_API_PORT=${opts.internalApiPort}`)
  }

  const container = await docker.createContainer({
    name: opts.containerName,
    Image: SIMBUS_IMAGE,
    Env: env,
    ExposedPorts: exposedPorts,
    Labels: {
      'simbus.managed': 'true',
      'simbus.device-id': opts.id,
      'simbus.device-type': opts.type,
    },
    HostConfig: {
      Binds: binds.length > 0 ? binds : undefined,
      PortBindings: portBindings,
      NetworkMode: DOCKER_NETWORK,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  })

  return container.id
}

export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId)
  await container.start()
}

export async function stopContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId)
  await container.stop({ t: 5 }).catch(() => {})
}

export async function removeContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId)
  await container.stop({ t: 5 }).catch(() => {})
  await container.remove({ force: true })
}

export async function getContainerStatus(
  containerId: string,
): Promise<'running' | 'stopped' | 'error' | 'unknown'> {
  try {
    const info = await docker.getContainer(containerId).inspect()
    if (info.State.Running) return 'running'
    if (info.State.Error) return 'error'
    return 'stopped'
  } catch {
    return 'unknown'
  }
}

// Regex that matches ANSI escape sequences (colors, styles, cursor controls, etc.)
// ESC (\x1b) and CSI (\x9b) are built with String.fromCharCode so ESLint
// does not flag the literal control characters.
const _ESC = String.fromCharCode(0x1b)
const _CSI = String.fromCharCode(0x9b)
const ANSI_ESCAPE_RE = new RegExp(
  `[${_ESC}${_CSI}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
  'g',
)

/**
 * Remove ANSI escape codes from a string so it renders as plain text.
 */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_RE, '')
}

export async function getContainerLogs(containerId: string, tail = 200): Promise<string> {
  const container = docker.getContainer(containerId)
  const buf = (await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  })) as unknown as Buffer

  // Docker multiplexes stdout/stderr with an 8-byte header per chunk.
  // Strip the headers to get plain text.
  const parts: string[] = []
  let offset = 0
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4)
    offset += 8
    if (size === 0) continue
    if (offset + size > buf.length) break
    parts.push(buf.subarray(offset, offset + size).toString('utf8'))
    offset += size
  }
  return stripAnsi(parts.join(''))
}

// --- Internal API URL resolution ---

export function resolveApiUrl(device: Device): string {
  // Read at runtime so the env var is not frozen at build time by Vite
  const mode = process.env['SIMBUS_UI_MODE'] ?? 'host'
  if (mode === 'docker') {
    // Same Docker network — reach container by name
    return `http://${device.dockerContainerName}:${device.internalApiPort}`
  }
  // Host mode — requires hostApiPort to be set
  if (device.hostApiPort) {
    return `http://localhost:${device.hostApiPort}`
  }
  throw new Error(
    `Device "${device.name}" has no hostApiPort set. ` +
      'Either expose the API port or run simbus-ui in docker mode.',
  )
}
