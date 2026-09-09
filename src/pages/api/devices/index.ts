import type { APIRoute } from 'astro'

import { z } from 'zod'

import { createDevice, DeviceError, listDevices } from '@/lib/devices'

export const GET: APIRoute = async () => {
  const rows = await listDevices()
  return Response.json(rows)
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  presetId: z.string().min(1).nullish(),
  yaml: z.string().nullish(),
  tickInterval: z.number().min(0.1).max(60).optional(),
  timeScale: z.number().min(0.1).max(100).optional(),
  seed: z.number().int().nullish(),
  hostModbusPort: z.number().int().min(1).max(65535).nullish(),
  publishModbus: z.boolean().optional(),
  desiredState: z.enum(['running', 'stopped']).optional(),
})

export const POST: APIRoute = async ({ request }) => {
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ detail: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const device = await createDevice(parsed.data)
    return Response.json(device, { status: 201 })
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Create failed'
    return Response.json({ detail: message }, { status: 500 })
  }
}
