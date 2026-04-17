import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { devices } from '@/db/schema'
import { resolveApiUrl } from '@/lib/docker'

export async function getDeviceApiUrl(deviceId: string): Promise<string | null> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) })
  if (!device) return null
  try {
    return resolveApiUrl(device)
  } catch {
    return null
  }
}

export async function proxyGet(deviceId: string, path: string): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  try {
    const upstream = await fetch(`${apiUrl}${path}`, { signal: AbortSignal.timeout(5000) })
    const data = await upstream.json()
    return Response.json(data, { status: upstream.status })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}

export async function proxyPatch(deviceId: string, path: string, body: unknown): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  try {
    const upstream = await fetch(`${apiUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    const data = await upstream.json()
    return Response.json(data, { status: upstream.status })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}

export async function proxyPost(deviceId: string, path: string, body: unknown): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  try {
    const upstream = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    const data = await upstream.json().catch(() => ({}))
    return Response.json(data, { status: upstream.status })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}

export async function proxyDelete(deviceId: string, path: string): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  try {
    const upstream = await fetch(`${apiUrl}${path}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    })
    return new Response(null, { status: upstream.status })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}

// SSE proxy — forwards the upstream stream directly to the browser
export async function proxySse(deviceId: string): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }
  try {
    const upstream = await fetch(`${apiUrl}/registers/stream`)
    if (!upstream.body) {
      return Response.json({ detail: 'No stream body' }, { status: 502 })
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}
