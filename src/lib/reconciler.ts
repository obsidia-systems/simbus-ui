import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { type Device, devices, portLeases } from '@/db/schema'
import {
  createContainer,
  getContainerStatus,
  inspectContainer,
  removeContainer,
  startContainer,
  stopContainer,
  yamlHashFromInspect,
} from '@/lib/docker'

export type ReconcileAction = 'ok' | 'started' | 'stopped' | 'recreated' | 'orphan-recreated'

export async function recreateDeviceContainer(device: Device): Promise<string> {
  if (device.dockerContainerId) {
    await removeContainer(device.dockerContainerId).catch(() => {})
  }

  const leases = await db.select().from(portLeases).where(eq(portLeases.deviceId, device.id))
  const containerId = await createContainer({
    id: device.id,
    name: device.name,
    containerName: device.dockerContainerName,
    yamlHash: device.yamlHash,
    tickInterval: device.tickInterval,
    timeScale: device.timeScale,
    seed: device.seed,
    leases,
    controlHostPort: device.controlHostPort,
    instancePath: device.instancePath,
  })

  await db.update(devices).set({ dockerContainerId: containerId }).where(eq(devices.id, device.id))

  if (device.desiredState === 'running') {
    await startContainer(containerId)
  }

  return containerId
}

export async function reconcileDevice(device: Device): Promise<ReconcileAction> {
  if (!device.dockerContainerId) {
    await recreateDeviceContainer(device)
    return 'orphan-recreated'
  }

  try {
    const info = await inspectContainer(device.dockerContainerId)
    const running = info.State.Running
    const hash = yamlHashFromInspect(info)

    if (hash !== device.yamlHash) {
      await recreateDeviceContainer(device)
      return 'recreated'
    }

    if (device.desiredState === 'running' && !running) {
      await startContainer(device.dockerContainerId)
      return 'started'
    }
    if (device.desiredState === 'stopped' && running) {
      await stopContainer(device.dockerContainerId)
      return 'stopped'
    }
    return 'ok'
  } catch {
    await recreateDeviceContainer(device)
    return 'orphan-recreated'
  }
}

export async function reconcileAll(): Promise<void> {
  const rows = await db.query.devices.findMany()
  for (const device of rows) {
    await reconcileDevice(device).catch(() => {})
  }
}

export { getContainerStatus }
