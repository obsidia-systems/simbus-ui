import type { APIRoute } from 'astro'

import { DeviceError, stopDevice } from '@/lib/devices'

export const POST: APIRoute = async ({ params }) => {
  try {
    const device = await stopDevice(params.id!)
    return Response.json(device)
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'Stop failed' }, { status: 500 })
  }
}
