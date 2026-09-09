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

export async function assertHostPortFree(port: number, label = 'Host port'): Promise<void> {
  const free = await isHostPortAvailable(port)
  if (!free) {
    throw new Error(`${label} ${port} is already in use by another container.`)
  }
}
