import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  query: {
    devices: {
      findFirst: vi.fn(),
    },
  },
}))

const mockResolveApiUrl = vi.hoisted(() => vi.fn())

// NOTE: proxy.ts imports `db` as a named export, so we must export it as `db`
vi.mock('@/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/docker', () => ({
  resolveApiUrl: mockResolveApiUrl,
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import {
  getDeviceApiUrl,
  proxyDelete,
  proxyGet,
  proxyPatch,
  proxyPost,
  proxySse,
} from '@/lib/proxy'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockFetchResponse(overrides?: Partial<Response>): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ data: 1 }),
    text: vi.fn().mockResolvedValue('ok'),
    body: new ReadableStream(),
    headers: new Headers(),
    ...overrides,
  } as unknown as Response
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getDeviceApiUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const url = await getDeviceApiUrl('missing-id')
    expect(url).toBeNull()
  })

  it('returns null when resolveApiUrl throws', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1', name: 'd' })
    mockResolveApiUrl.mockImplementation(() => {
      throw new Error('no port')
    })
    const url = await getDeviceApiUrl('1')
    expect(url).toBeNull()
  })

  it('returns the resolved URL on success', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1', name: 'd' })
    mockResolveApiUrl.mockReturnValue('http://localhost:9000')
    const url = await getDeviceApiUrl('1')
    expect(url).toBe('http://localhost:9000')
  })
})

describe('proxyGet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const res = await proxyGet('bad-id', '/status')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: 'Device not found' })
  })

  it('proxies GET and returns upstream JSON', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({
      status: 200,
      json: vi.fn().mockResolvedValue({ sim: 'running' }),
    })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxyGet('1', '/status')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://sim:8000/status', {
      signal: expect.any(AbortSignal),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sim: 'running' })
  })

  it('returns 503 when fetch throws', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await proxyGet('1', '/status')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ detail: 'Device unreachable' })
  })
})

describe('proxyPatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const res = await proxyPatch('x', '/registers/0', { value: 1 })
    expect(res.status).toBe(404)
  })

  it('sends PATCH with JSON body and returns upstream response', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({
      status: 200,
      json: vi.fn().mockResolvedValue({ updated: true }),
    })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxyPatch('1', '/registers/0', { value: 100 })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://sim:8000/registers/0', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 100 }),
      signal: expect.any(AbortSignal),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: true })
  })

  it('returns 503 on network error', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('timeout'))

    const res = await proxyPatch('1', '/simulation', {})
    expect(res.status).toBe(503)
  })
})

describe('proxyPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const res = await proxyPost('x', '/faults', {})
    expect(res.status).toBe(404)
  })

  it('returns upstream JSON on success', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({
      json: vi.fn().mockResolvedValue({ id: 'fault-1' }),
    })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxyPost('1', '/faults', { type: 'spike' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'fault-1' })
  })

  it('returns empty object when upstream body is not valid JSON', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({
      json: vi.fn().mockRejectedValue(new Error('not json')),
      text: vi.fn().mockResolvedValue('ok'),
    })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxyPost('1', '/reset', {})
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
  })
})

describe('proxyDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const res = await proxyDelete('x', '/faults')
    expect(res.status).toBe(404)
  })

  it('returns null-body Response on success', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({ status: 204 })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxyDelete('1', '/faults')
    expect(res.status).toBe(204)
    expect(res.body).toBeNull()
  })

  it('returns 503 on network error', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('down'))

    const res = await proxyDelete('1', '/faults')
    expect(res.status).toBe(503)
  })
})

describe('proxySse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    const res = await proxySse('x')
    expect(res.status).toBe(404)
  })

  it('returns 502 when upstream has no body', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const upstream = mockFetchResponse({ body: null })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxySse('1')
    expect(res.status).toBe(502)
  })

  it('forwards the stream with SSE headers on success', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')

    const stream = new ReadableStream()
    const upstream = mockFetchResponse({ body: stream })
    vi.mocked(globalThis.fetch).mockResolvedValue(upstream)

    const res = await proxySse('1')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
    expect(res.headers.get('Connection')).toBe('keep-alive')
    expect(res.headers.get('X-Accel-Buffering')).toBe('no')
    expect(res.body).toBe(stream)
  })

  it('returns 503 when fetch throws', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('timeout'))

    const res = await proxySse('1')
    expect(res.status).toBe(503)
  })
})
