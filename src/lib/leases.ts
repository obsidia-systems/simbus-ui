import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { portLeases } from '@/db/schema'
import { isHostPortAvailable } from '@/lib/ports'
import type { FieldProtocol } from '@/types/simbus'

export { slugify } from '@/lib/names'

const FIELD_PORT_START = 5020
const FIELD_PORT_END = 5999
const CONTROL_PORT_START = 8100
const CONTROL_PORT_END = 8999

export async function allocateHostPort(rangeStart: number, rangeEnd: number): Promise<number> {
  const existing = await db.select({ hostPort: portLeases.hostPort }).from(portLeases)
  const leased = new Set(existing.map((r) => r.hostPort))
  const devices = await db.query.devices.findMany()
  for (const d of devices) {
    if (d.controlHostPort != null) leased.add(d.controlHostPort)
  }

  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (leased.has(port)) continue
    if (await isHostPortAvailable(port)) return port
  }
  throw new Error(`No free host port in ${rangeStart}–${rangeEnd}`)
}

export async function allocateFieldPort(): Promise<number> {
  return allocateHostPort(FIELD_PORT_START, FIELD_PORT_END)
}

export async function allocateControlPort(): Promise<number> {
  return allocateHostPort(CONTROL_PORT_START, CONTROL_PORT_END)
}

export async function replaceDeviceLeases(
  deviceId: string,
  leases: Array<{
    protocol: FieldProtocol | string
    containerPort: number
    hostPort: number
    proto: 'tcp' | 'udp'
    published: boolean
  }>,
): Promise<void> {
  await db.delete(portLeases).where(eq(portLeases.deviceId, deviceId))
  if (leases.length === 0) return
  await db.insert(portLeases).values(
    leases.map((l) => ({
      id: crypto.randomUUID(),
      deviceId,
      protocol: l.protocol,
      containerPort: l.containerPort,
      hostPort: l.hostPort,
      proto: l.proto,
      published: l.published,
    })),
  )
}
