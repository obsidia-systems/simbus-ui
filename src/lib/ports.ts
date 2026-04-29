import { docker } from './docker'

/**
 * Check whether a given host port is already bound by a Docker container
 * (running or stopped). Queries `docker.listContainers({ all: true })`.
 */
export async function isHostPortAvailable(port: number): Promise<boolean> {
  const containers = await docker.listContainers({ all: true })
  for (const container of containers) {
    for (const mapping of container.Ports ?? []) {
      if (mapping.PublicPort === port) {
        return false
      }
    }
  }
  return true
}

/**
 * Validate that the requested host-side ports are not already in use.
 * Throws an Error with a descriptive message if either port is taken.
 */
export async function validateHostPorts(
  modbusPort?: number | null,
  apiPort?: number | null,
): Promise<void> {
  if (modbusPort != null) {
    const free = await isHostPortAvailable(modbusPort)
    if (!free) {
      throw new Error(`Host Modbus port ${modbusPort} is already in use by another container.`)
    }
  }

  if (apiPort != null) {
    const free = await isHostPortAvailable(apiPort)
    if (!free) {
      throw new Error(`Host API port ${apiPort} is already in use by another container.`)
    }
  }
}
