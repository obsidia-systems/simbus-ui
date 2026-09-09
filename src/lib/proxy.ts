import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { devices } from '@/db/schema'
import { resolveApiUrl } from '@/lib/docker'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function getDeviceApiUrl(deviceId: string): Promise<string | null> {
  const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) })
  if (!device) return null
  try {
    return resolveApiUrl(device)
  } catch {
    return null
  }
}

export async function proxyRequest(
  deviceId: string,
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const apiUrl = await getDeviceApiUrl(deviceId)
  if (!apiUrl) {
    return Response.json({ detail: 'Device not found' }, { status: 404 })
  }

  const { timeoutMs, ...rest } = init ?? {}
  const isSse = path.includes('/stream')
  const signal = rest.signal ?? (isSse ? undefined : AbortSignal.timeout(timeoutMs ?? 5000))

  try {
    const upstream = await fetch(`${apiUrl}${path}`, { ...rest, signal })
    const contentType = upstream.headers.get('content-type') ?? 'application/json'
    if (contentType.includes('text/event-stream') && upstream.body) {
      return new Response(upstream.body, { headers: SSE_HEADERS })
    }
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return Response.json({ detail: 'Device unreachable' }, { status: 503 })
  }
}

export async function proxyGet(deviceId: string, path: string): Promise<Response> {
  return jsonish(await proxyRequest(deviceId, path, { method: 'GET' }))
}

export async function proxyPatch(deviceId: string, path: string, body: unknown): Promise<Response> {
  return jsonish(
    await proxyRequest(deviceId, path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function proxyPost(deviceId: string, path: string, body: unknown): Promise<Response> {
  return jsonish(
    await proxyRequest(deviceId, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function proxyDelete(deviceId: string, path: string): Promise<Response> {
  const res = await proxyRequest(deviceId, path, { method: 'DELETE' })
  if (res.status === 404 || res.status === 503) return res
  if (res.headers.get('content-type')?.includes('application/json')) return jsonish(res)
  return new Response(null, { status: res.status })
}

export async function proxySse(deviceId: string, path = '/points/stream'): Promise<Response> {
  return proxyRequest(deviceId, path)
}

async function jsonish(res: Response): Promise<Response> {
  if (res.headers.get('content-type')?.includes('text/event-stream')) return res
  const status = res.status
  try {
    const data = await res.json()
    return Response.json(data, { status })
  } catch {
    return Response.json(status === 204 ? null : {}, { status })
  }
}
