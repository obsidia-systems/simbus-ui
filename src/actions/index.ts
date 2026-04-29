import { defineAction } from 'astro:actions'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { devices, templates } from '@/db/schema'
import {
  createContainer,
  getContainerStatus,
  removeContainer,
  startContainer,
  stopContainer,
  writeDeviceYaml,
} from '@/lib/docker'
import { validateHostPorts } from '@/lib/ports'
import { proxyDelete, proxyPatch, proxyPost } from '@/lib/proxy'

// --- Shared helpers ---

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uuid(): string {
  return crypto.randomUUID()
}

// --- Actions ---

export const server = {
  devices: {
    create: defineAction({
      input: z.object({
        name: z.string().min(1).max(64),
        type: z.string().min(1),
        internalModbusPort: z.number().int().min(1).max(65535).default(502),
        internalApiPort: z.number().int().min(1024).max(65535).default(8000),
        hostModbusPort: z.number().int().min(1).max(65535).nullish(),
        hostApiPort: z.number().int().min(1024).max(65535).nullish(),
        tickInterval: z.number().min(0.1).max(60).default(1.0),
        seed: z.number().int().nullish(),
        yamlConfig: z.string().nullish(),
      }),
      handler: async (input) => {
        const id = uuid()
        const containerName = `simbus-${slugify(input.type.replace('generic-', ''))}-${slugify(input.name)}`

        await validateHostPorts(input.hostModbusPort, input.hostApiPort)

        const containerId = await createContainer({
          id,
          name: input.name,
          type: input.type,
          containerName,
          internalModbusPort: input.internalModbusPort,
          internalApiPort: input.internalApiPort,
          hostModbusPort: input.hostModbusPort,
          hostApiPort: input.hostApiPort,
          tickInterval: input.tickInterval,
          seed: input.seed,
          yamlConfig: input.yamlConfig,
        })

        await startContainer(containerId)

        await db.insert(devices).values({
          id,
          name: input.name,
          type: input.type,
          dockerContainerId: containerId,
          dockerContainerName: containerName,
          internalModbusPort: input.internalModbusPort,
          internalApiPort: input.internalApiPort,
          hostModbusPort: input.hostModbusPort ?? null,
          hostApiPort: input.hostApiPort ?? null,
          tickInterval: input.tickInterval,
          seed: input.seed ?? null,
          yamlConfig: input.yamlConfig ?? null,
          createdAt: Date.now(),
        })

        return { id, containerName }
      },
    }),

    start: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
        if (!device?.dockerContainerId) throw new Error('Device not found')
        if (device.type === 'custom' && device.yamlConfig) {
          await writeDeviceYaml(device.id, device.yamlConfig)
        }
        await startContainer(device.dockerContainerId)
        return { ok: true }
      },
    }),

    stop: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
        if (!device?.dockerContainerId) throw new Error('Device not found')
        await stopContainer(device.dockerContainerId)
        return { ok: true }
      },
    }),

    remove: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
        if (!device) throw new Error('Device not found')
        if (device.dockerContainerId) {
          await removeContainer(device.dockerContainerId)
        }
        await db.delete(devices).where(eq(devices.id, id))
        return { ok: true }
      },
    }),

    syncStatus: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        const device = await db.query.devices.findFirst({ where: eq(devices.id, id) })
        if (!device?.dockerContainerId) throw new Error('Device not found')
        const status = await getContainerStatus(device.dockerContainerId)
        return { status }
      },
    }),
  },

  registers: {
    overrideHolding: defineAction({
      input: z.object({
        deviceId: z.string(),
        address: z.number().int(),
        value: z.number().int().min(0).max(65535).optional(),
        real_value: z.number().optional(),
      }),
      handler: async ({ deviceId, address, value, real_value }) => {
        const res = await proxyPatch(deviceId, `/registers/${address}`, { value, real_value })
        if (!res.ok) throw new Error('Override failed')
        return { ok: true }
      },
    }),

    overrideInput: defineAction({
      input: z.object({
        deviceId: z.string(),
        address: z.number().int(),
        value: z.number().int().min(0).max(65535).optional(),
        real_value: z.number().optional(),
      }),
      handler: async ({ deviceId, address, value, real_value }) => {
        const res = await proxyPatch(deviceId, `/registers/input/${address}`, { value, real_value })
        if (!res.ok) throw new Error('Override failed')
        return { ok: true }
      },
    }),

    overrideCoil: defineAction({
      input: z.object({
        deviceId: z.string(),
        address: z.number().int(),
        value: z.boolean(),
      }),
      handler: async ({ deviceId, address, value }) => {
        const res = await proxyPatch(deviceId, `/registers/coils/${address}`, { value })
        if (!res.ok) throw new Error('Override failed')
        return { ok: true }
      },
    }),

    overrideDiscrete: defineAction({
      input: z.object({
        deviceId: z.string(),
        address: z.number().int(),
        value: z.boolean(),
      }),
      handler: async ({ deviceId, address, value }) => {
        const res = await proxyPatch(deviceId, `/registers/discrete/${address}`, { value })
        if (!res.ok) throw new Error('Override failed')
        return { ok: true }
      },
    }),
  },

  simulation: {
    patch: defineAction({
      input: z.object({
        deviceId: z.string(),
        tick_interval: z.number().min(0.1).max(60),
      }),
      handler: async ({ deviceId, tick_interval }) => {
        const res = await proxyPatch(deviceId, '/simulation', { tick_interval })
        if (!res.ok) throw new Error('Patch failed')
        return { ok: true }
      },
    }),

    reset: defineAction({
      input: z.object({ deviceId: z.string() }),
      handler: async ({ deviceId }) => {
        const res = await proxyPost(deviceId, '/simulation/reset', {})
        // 503 is expected: simbus drops the connection when resetting its sim loop
        if (!res.ok && res.status !== 503) throw new Error(`Reset failed: ${res.status}`)
        return { ok: true }
      },
    }),
  },

  templates: {
    create: defineAction({
      input: z.object({
        name: z.string().min(1).max(64),
        description: z.string().optional(),
        type: z.string().min(1),
        internalModbusPort: z.number().int().min(1).max(65535).default(502),
        internalApiPort: z.number().int().min(1024).max(65535).default(8000),
        tickInterval: z.number().min(0.1).max(60).default(1.0),
        seed: z.number().int().nullish(),
        yamlConfig: z.string().nullish(),
      }),
      handler: async (input) => {
        const id = uuid()
        await db.insert(templates).values({
          id,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          internalModbusPort: input.internalModbusPort,
          internalApiPort: input.internalApiPort,
          tickInterval: input.tickInterval,
          seed: input.seed ?? null,
          yamlConfig: input.yamlConfig ?? null,
          createdAt: Date.now(),
        })
        return { id }
      },
    }),

    delete: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
        await db.delete(templates).where(eq(templates.id, id))
        return { ok: true }
      },
    }),
  },

  faults: {
    inject: defineAction({
      input: z.object({
        deviceId: z.string(),
        fault_type: z.enum(['spike', 'freeze', 'dropout', 'alarm', 'noise_amplify']),
        register_name: z.string().optional(),
        value: z.number().optional(),
        duration_s: z.number().min(1).default(30),
      }),
      handler: async ({ deviceId, ...body }) => {
        const res = await proxyPost(deviceId, '/faults', body)
        if (!res.ok) throw new Error('Fault injection failed')
        return { ok: true }
      },
    }),

    clear: defineAction({
      input: z.object({ deviceId: z.string() }),
      handler: async ({ deviceId }) => {
        const res = await proxyDelete(deviceId, '/faults')
        if (!res.ok) throw new Error('Clear failed')
        return { ok: true }
      },
    }),
  },
}
