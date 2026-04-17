import type { APIRoute } from 'astro'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { devices } from '@/db/schema'
import { getContainerLogs } from '@/lib/docker'

export const GET: APIRoute = async ({ params, url }) => {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, params.id!) })
  if (!device?.dockerContainerId) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  const tail = Math.min(Number(url.searchParams.get('tail') ?? '200'), 1000)
  try {
    const logs = await getContainerLogs(device.dockerContainerId, tail)
    return new Response(logs, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch {
    return Response.json({ detail: 'Failed to read logs' }, { status: 500 })
  }
}
