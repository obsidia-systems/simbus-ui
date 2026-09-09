import Dockerode from 'dockerode'

import type { PortLease } from '@/db/schema'
import { instanceYamlPath } from '@/lib/paths'
import {
  dockerNetwork,
  publishedPortBindings,
  resolveApiUrl,
  simbusImage,
  yamlBind,
} from '@/lib/runtime'

export { resolveApiUrl }

export const docker = new Dockerode()

const DEVICE_USER = '65532:65532'
const MEMORY_BYTES = 128 * 1024 * 1024
const PIDS_LIMIT = 64

export async function ensureNetwork(): Promise<void> {
  const name = dockerNetwork()
  const networks = await docker.listNetworks({ filters: { name: [name] } })
  const exists = networks.some((n) => n.Name === name)
  if (!exists) {
    await docker.createNetwork({ Name: name, Driver: 'bridge' })
  }
}

export interface CreateContainerOptions {
  id: string
  name: string
  containerName: string
  yamlHash: string
  tickInterval: number
  timeScale: number
  seed?: number | null
  leases: Pick<PortLease, 'containerPort' | 'hostPort' | 'proto' | 'published'>[]
  controlHostPort?: number | null
  instancePath?: string
}

export async function createContainer(opts: CreateContainerOptions): Promise<string> {
  await ensureNetwork()

  const instancePath = opts.instancePath ?? instanceYamlPath(opts.id)
  const { binds, yamlPathInContainer } = yamlBind(opts.id, instancePath)
  const { exposedPorts, portBindings } = publishedPortBindings(
    opts.leases,
    opts.controlHostPort ?? null,
  )

  const env: string[] = [
    `SIMBUS_YAML_PATH=${yamlPathInContainer}`,
    `SIMBUS_DEVICE_NAME=${opts.name}`,
    `SIMBUS_TICK_INTERVAL=${opts.tickInterval}`,
    `SIMBUS_TIME_SCALE=${opts.timeScale}`,
    `SIMBUS_CORS_ORIGINS=["*"]`,
  ]
  if (opts.seed != null) env.push(`SIMBUS_SEED=${opts.seed}`)

  const container = await docker.createContainer({
    name: opts.containerName,
    Image: simbusImage(),
    User: DEVICE_USER,
    Env: env,
    ExposedPorts: exposedPorts,
    Labels: {
      'simbus.managed': 'true',
      'simbus.device-id': opts.id,
      'simbus.yaml-hash': opts.yamlHash,
    },
    HostConfig: {
      Binds: binds,
      PortBindings: portBindings,
      NetworkMode: dockerNetwork(),
      RestartPolicy: { Name: 'unless-stopped' },
      ReadonlyRootfs: true,
      CapDrop: ['ALL'],
      CapAdd: ['NET_BIND_SERVICE'],
      SecurityOpt: ['no-new-privileges:true'],
      PidsLimit: PIDS_LIMIT,
      Memory: MEMORY_BYTES,
      NanoCpus: 1_000_000_000,
      Init: true,
      Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=16m' },
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

export async function inspectContainer(containerId: string) {
  return docker.getContainer(containerId).inspect()
}

export async function getContainerStatus(
  containerId: string,
): Promise<'running' | 'stopped' | 'error' | 'unknown'> {
  try {
    const info = await inspectContainer(containerId)
    if (info.State.Running) return 'running'
    if (info.State.Error) return 'error'
    return 'stopped'
  } catch {
    return 'unknown'
  }
}

export function yamlHashFromInspect(info: Dockerode.ContainerInspectInfo): string | null {
  return info.Config.Labels?.['simbus.yaml-hash'] ?? null
}

const _ESC = String.fromCharCode(0x1b)
const _CSI = String.fromCharCode(0x9b)
const ANSI_ESCAPE_RE = new RegExp(
  `[${_ESC}${_CSI}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
  'g',
)

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
