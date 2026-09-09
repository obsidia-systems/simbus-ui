import type { APIRoute } from 'astro'

import { z } from 'zod'

import { clearSite, DeviceError, startAllDevices, stopAllDevices } from '@/lib/devices'

const schema = z.object({
  action: z.enum(['stop', 'start', 'clear']),
})

export const POST: APIRoute = async ({ request }) => {
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ detail: parsed.error.flatten() }, { status: 400 })
  }
  try {
    if (parsed.data.action === 'stop') return Response.json(await stopAllDevices())
    if (parsed.data.action === 'start') return Response.json(await startAllDevices())
    return Response.json(await clearSite())
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Site action failed'
    return Response.json({ detail: message }, { status: 500 })
  }
}
