import type { APIRoute } from 'astro'

import { DeviceError, recreateDevice } from '@/lib/devices'

export const POST: APIRoute = async ({ params }) => {
  try {
    const device = await recreateDevice(params.id!)
    return Response.json(device)
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'Recreate failed' }, { status: 500 })
  }
}
