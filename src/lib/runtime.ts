import type { Device, PortLease } from '@/db/schema'

export const SIMBUS_CONTROL_PORT = 8000
export const DEFAULT_MODBUS_PORT = 502

/** Engine this UI is tested against. Override with SIMBUS_IMAGE only for experiments. */
export const DEFAULT_SIMBUS_IMAGE = 'ghcr.io/obsidia-systems/simbus:0.3.0'

export function simbusImage(): string {
  return process.env.SIMBUS_IMAGE ?? DEFAULT_SIMBUS_IMAGE
}

export function dockerNetwork(): string {
  return process.env.DOCKER_NETWORK ?? 'simbus-net'
}

export function uiMode(): 'docker' | 'host' {
  return process.env['SIMBUS_UI_MODE'] === 'docker' ? 'docker' : 'host'
}

/** Named volume shared with device containers (Docker-from-Docker). */
export function instanceVolume(): string | undefined {
  return process.env.SIMBUS_INSTANCE_VOLUME
}

export function resolveApiUrl(device: Device): string {
  const mode = uiMode()
  if (mode === 'docker') {
    return `http://${device.dockerContainerName}:${SIMBUS_CONTROL_PORT}`
  }
  if (device.controlHostPort) {
    return `http://127.0.0.1:${device.controlHostPort}`
  }
  throw new Error(
    `Device "${device.name}" has no loopback control port. ` +
      'Host mode binds HTTP :8000 to 127.0.0.1 only.',
  )
}

export function yamlBind(
  deviceId: string,
  instancePath: string,
): {
  binds: string[]
  yamlPathInContainer: string
} {
  const volume = instanceVolume()
  if (volume) {
    return {
      binds: [`${volume}:/config-store:ro`],
      yamlPathInContainer: `/config-store/instances/${deviceId}.yaml`,
    }
  }
  return {
    binds: [`${instancePath}:/config/device.yaml:ro`],
    yamlPathInContainer: '/config/device.yaml',
  }
}

export function publishedPortBindings(
  leases: Pick<PortLease, 'containerPort' | 'hostPort' | 'proto' | 'published'>[],
  controlHostPort: number | null,
): {
  exposedPorts: Record<string, object>
  portBindings: Record<string, { HostIp?: string; HostPort: string }[]>
} {
  const exposedPorts: Record<string, object> = {}
  const portBindings: Record<string, { HostIp?: string; HostPort: string }[]> = {}

  for (const lease of leases) {
    if (!lease.published) continue
    const key = `${lease.containerPort}/${lease.proto}`
    exposedPorts[key] = {}
    portBindings[key] = [{ HostPort: String(lease.hostPort) }]
  }

  if (uiMode() === 'host' && controlHostPort != null) {
    const key = `${SIMBUS_CONTROL_PORT}/tcp`
    exposedPorts[key] = {}
    portBindings[key] = [{ HostIp: '127.0.0.1', HostPort: String(controlHostPort) }]
  }

  return { exposedPorts, portBindings }
}
