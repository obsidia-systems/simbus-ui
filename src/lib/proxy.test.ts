import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  query: {
    devices: {
      findFirst: vi.fn(),
    },
  },
}))

const mockResolveApiUrl = vi.hoisted(() => vi.fn())

vi.mock('@/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/docker', () => ({
  resolveApiUrl: mockResolveApiUrl,
}))

import {
  getDeviceApiUrl,
  proxyDelete,
  proxyGet,
  proxyPatch,
  proxyPost,
  proxySse,
} from '@/lib/proxy'

function mockFetchResponse(overrides?: Partial<Response>): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ data: 1 }),
    text: vi.fn().mockResolvedValue('ok'),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    body: new ReadableStream(),
    headers: new Headers({ 'content-type': 'application/json' }),
    ...overrides,
  } as unknown as Response
}

describe('getDeviceApiUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when device is not found', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue(undefined)
    expect(await getDeviceApiUrl('missing-id')).toBeNull()
  })

  it('returns the resolved URL on success', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1', name: 'd' })
    mockResolveApiUrl.mockReturnValue('http://localhost:9000')
    expect(await getDeviceApiUrl('1')).toBe('http://localhost:9000')
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
  })

  it('proxies GET and returns upstream JSON', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse({
        json: vi.fn().mockResolvedValue({ sim: 'running' }),
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new TextEncoder().encode('{"sim":"running"}').buffer),
        headers: new Headers({ 'content-type': 'application/json' }),
      }),
    )
    const res = await proxyGet('1', '/status')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://sim:8000/status', {
      method: 'GET',
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
  })
})

describe('proxyPatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends PATCH with JSON body', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse({
        json: vi.fn().mockResolvedValue({ updated: true }),
        arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('{"updated":true}').buffer),
      }),
    )
    const res = await proxyPatch('1', '/points/temperature', { value: 22 })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://sim:8000/points/temperature',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(res.status).toBe(200)
  })
})

describe('proxyPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns empty object when upstream body is not valid JSON', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse({
        json: vi.fn().mockRejectedValue(new Error('not json')),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        headers: new Headers({ 'content-type': 'text/plain' }),
      }),
    )
    const res = await proxyPost('1', '/scenarios/heat-wave/run', {})
    expect(res.status).toBe(200)
  })
})

describe('proxyDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
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

  it('forwards /points/stream with SSE headers', async () => {
    mockDb.query.devices.findFirst.mockResolvedValue({ id: '1' })
    mockResolveApiUrl.mockReturnValue('http://sim:8000')
    const stream = new ReadableStream()
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse({
        body: stream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      }),
    )
    const res = await proxySse('1')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://sim:8000/points/stream',
      expect.anything(),
    )
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.body).toBe(stream)
  })
})
