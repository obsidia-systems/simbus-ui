import type { APIRoute } from 'astro'

import { DeviceError, deviceLogs } from '@/lib/devices'

export const GET: APIRoute = async ({ params, url }) => {
  const tail = Number(url.searchParams.get('tail') ?? 200)
  try {
    const logs = await deviceLogs(params.id!, Number.isFinite(tail) ? tail : 200)
    return new Response(logs, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'Logs unavailable' }, { status: 500 })
  }
}
