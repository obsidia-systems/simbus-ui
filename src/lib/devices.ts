import fs from 'node:fs/promises'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { type Device, devices, type PortLease, portLeases } from '@/db/schema'
import { checkYamlFile, readPresetYaml } from '@/lib/catalog'
import {
  docker,
  getContainerLogs,
  getContainerStatus,
  removeContainer,
  stopContainer,
} from '@/lib/docker'
import { allocateControlPort, allocateFieldPort, replaceDeviceLeases } from '@/lib/leases'
import { containerNameBase, nextUniqueName } from '@/lib/names'
import { instanceYamlPath } from '@/lib/paths'
import { assertHostPortFree } from '@/lib/ports'
import { reconcileDevice, recreateDeviceContainer } from '@/lib/reconciler'
import { DEFAULT_MODBUS_PORT, uiMode } from '@/lib/runtime'
import {
  applyDeviceName,
  extractConnectMeta,
  hashYaml,
  readInstanceYaml,
  writeInstanceYaml,
} from '@/lib/yaml'

export class DeviceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'DeviceError'
  }
}

export interface CreateDeviceInput {
  name: string
  presetId?: string | null
  yaml?: string | null
  tickInterval?: number
  timeScale?: number
  seed?: number | null
  hostModbusPort?: number | null
  publishModbus?: boolean
  desiredState?: 'running' | 'stopped'
}

export type DeviceListItem = Device & {
  dockerStatus: 'running' | 'stopped' | 'error' | 'unknown'
  leases: PortLease[]
  unitId: number | null
}

export type BulkSiteResult = {
  action: 'stop' | 'start' | 'clear'
  ok: number
  failed: number
}

async function takenContainerNames(): Promise<Set<string>> {
  const rows = await db.select({ dockerContainerName: devices.dockerContainerName }).from(devices)
  const names = new Set(rows.map((r) => r.dockerContainerName))
  try {
    const containers = await docker.listContainers({ all: true })
    for (const container of containers) {
      for (const raw of container.Names ?? []) {
        names.add(raw.replace(/^\//, ''))
      }
    }
  } catch {
    /* daemon unreachable — SQLite names are still unique */
  }
  return names
}

function unitIdFor(deviceId: string): number | null {
  try {
    return extractConnectMeta(readInstanceYaml(deviceId)).unitId
  } catch {
    return null
  }
}

export async function listDevices(): Promise<DeviceListItem[]> {
  const rows = await db.query.devices.findMany({
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  })
  return Promise.all(
    rows.map(async (device) => {
      const leases = await db.select().from(portLeases).where(eq(portLeases.deviceId, device.id))
      const dockerStatus = device.dockerContainerId
        ? await getContainerStatus(device.dockerContainerId)
        : 'unknown'
      const unitId = unitIdFor(device.id)
      return { ...device, dockerStatus, leases, unitId }
    }),
  )
}

export async function getDevice(id: string): Promise<DeviceListItem | null> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) return null
  const leases = await db.select().from(portLeases).where(eq(portLeases.deviceId, id))
  const dockerStatus = device.dockerContainerId
    ? await getContainerStatus(device.dockerContainerId)
    : 'unknown'
  return { ...device, dockerStatus, leases, unitId: unitIdFor(id) }
}

export async function createDevice(input: CreateDeviceInput): Promise<DeviceListItem> {
  const name = input.name.trim()
  if (!name) throw new DeviceError('Name is required')

  let yaml = input.yaml?.trim() ? input.yaml : null
  if (!yaml) {
    if (!input.presetId) throw new DeviceError('Choose a preset or provide YAML')
    yaml = readPresetYaml(input.presetId)
  }
  yaml = applyDeviceName(yaml, name)

  const id = crypto.randomUUID()
  const instancePath = instanceYamlPath(id)
  await writeInstanceYaml(id, yaml)

  const check = await checkYamlFile(instancePath, id).catch((err: Error) => ({
    ok: false,
    output: err.message,
  }))
  if (!check.ok) {
    throw new DeviceError(`simbus check failed: ${check.output || 'invalid YAML'}`, 422)
  }

  const yamlHash = hashYaml(yaml)
  const tickInterval = input.tickInterval ?? 1
  const timeScale = input.timeScale ?? 1
  const publishModbus = input.publishModbus ?? true
  const desiredState = input.desiredState ?? 'running'

  let hostModbus = input.hostModbusPort ?? null
  if (publishModbus) {
    hostModbus = hostModbus ?? (await allocateFieldPort())
    await assertHostPortFree(hostModbus, 'Host Modbus port')
  }

  const controlHostPort = uiMode() === 'host' ? await allocateControlPort() : null
  const dockerContainerName = nextUniqueName(
    containerNameBase(input.presetId, name),
    await takenContainerNames(),
  )

  await db.insert(devices).values({
    id,
    name,
    presetId: input.presetId ?? null,
    instancePath,
    yamlHash,
    dockerContainerId: null,
    dockerContainerName,
    tickInterval,
    timeScale,
    seed: input.seed ?? null,
    desiredState,
    controlHostPort,
    createdAt: Date.now(),
  })

  const fieldLeases: Array<{
    protocol: string
    containerPort: number
    hostPort: number
    proto: 'tcp' | 'udp'
    published: boolean
  }> = []
  if (publishModbus && hostModbus) {
    fieldLeases.push({
      protocol: 'modbus-tcp',
      containerPort: DEFAULT_MODBUS_PORT,
      hostPort: hostModbus,
      proto: 'tcp',
      published: true,
    })
  }
  await replaceDeviceLeases(id, fieldLeases)

  const row = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!row) throw new DeviceError('Failed to persist device', 500)

  try {
    const containerId = await recreateDeviceContainer(row)
    await db.update(devices).set({ dockerContainerId: containerId }).where(eq(devices.id, id))
  } catch (err) {
    await db.delete(devices).where(eq(devices.id, id))
    throw new DeviceError(err instanceof Error ? err.message : 'Failed to create container', 500)
  }

  const created = await getDevice(id)
  if (!created) throw new DeviceError('Failed to load device', 500)
  return created
}

export async function startDevice(id: string): Promise<DeviceListItem> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  await db.update(devices).set({ desiredState: 'running' }).where(eq(devices.id, id))
  await reconcileDevice({ ...device, desiredState: 'running' })
  const out = await getDevice(id)
  if (!out) throw new DeviceError('Device not found', 404)
  return out
}

export async function stopDevice(id: string): Promise<DeviceListItem> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  await db.update(devices).set({ desiredState: 'stopped' }).where(eq(devices.id, id))
  if (device.dockerContainerId) await stopContainer(device.dockerContainerId)
  const out = await getDevice(id)
  if (!out) throw new DeviceError('Device not found', 404)
  return out
}

export async function recreateDevice(id: string): Promise<DeviceListItem> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  await recreateDeviceContainer(device)
  const out = await getDevice(id)
  if (!out) throw new DeviceError('Device not found', 404)
  return out
}

export async function removeDevice(id: string): Promise<void> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  if (device.dockerContainerId) {
    await removeContainer(device.dockerContainerId).catch(() => {})
  }
  await db.delete(devices).where(eq(devices.id, id))
  await fs.unlink(instanceYamlPath(id)).catch(() => {})
}

export async function stopAllDevices(): Promise<BulkSiteResult> {
  const rows = await db.query.devices.findMany()
  let ok = 0
  let failed = 0
  for (const row of rows) {
    try {
      await db.update(devices).set({ desiredState: 'stopped' }).where(eq(devices.id, row.id))
      if (row.dockerContainerId) await stopContainer(row.dockerContainerId)
      ok++
    } catch {
      failed++
    }
  }
  return { action: 'stop', ok, failed }
}

export async function startAllDevices(): Promise<BulkSiteResult> {
  const rows = await db.query.devices.findMany()
  let ok = 0
  let failed = 0
  for (const row of rows) {
    try {
      await db.update(devices).set({ desiredState: 'running' }).where(eq(devices.id, row.id))
      await reconcileDevice({ ...row, desiredState: 'running' })
      ok++
    } catch {
      failed++
    }
  }
  return { action: 'start', ok, failed }
}

export async function clearSite(): Promise<BulkSiteResult> {
  const rows = await db.query.devices.findMany()
  let ok = 0
  let failed = 0
  for (const row of rows) {
    try {
      await removeDevice(row.id)
      ok++
    } catch {
      failed++
    }
  }
  return { action: 'clear', ok, failed }
}

export async function updateDeviceYaml(id: string, yaml: string): Promise<DeviceListItem> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  const named = applyDeviceName(yaml, device.name)
  await writeInstanceYaml(id, named)
  const check = await checkYamlFile(device.instancePath, id).catch((err: Error) => ({
    ok: false,
    output: err.message,
  }))
  if (!check.ok) {
    throw new DeviceError(`simbus check failed: ${check.output || 'invalid YAML'}`, 422)
  }
  const yamlHash = hashYaml(named)
  await db.update(devices).set({ yamlHash }).where(eq(devices.id, id))
  const next = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!next) throw new DeviceError('Device not found', 404)
  await recreateDeviceContainer(next)
  const out = await getDevice(id)
  if (!out) throw new DeviceError('Device not found', 404)
  return out
}

export async function deviceLogs(id: string, tail = 200): Promise<string> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
  if (!device) throw new DeviceError('Device not found', 404)
  if (!device.dockerContainerId) return ''
  return getContainerLogs(device.dockerContainerId, tail)
}
