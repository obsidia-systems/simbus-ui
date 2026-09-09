import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsHostPortAvailable, mockDb } = vi.hoisted(() => {
  const mockIsHostPortAvailable = vi.fn()
  const mockDb = {
    select: vi.fn(),
    query: {
      devices: { findMany: vi.fn() },
    },
    delete: vi.fn(),
    insert: vi.fn(),
  }
  return { mockIsHostPortAvailable, mockDb }
})

vi.mock('@/lib/ports', () => ({
  isHostPortAvailable: mockIsHostPortAvailable,
}))

vi.mock('@/db', () => ({
  db: mockDb,
}))

import { allocateFieldPort, slugify } from '@/lib/leases'

describe('slugify', () => {
  it('slugifies device names', () => {
    expect(slugify('Hot Aisle 01')).toBe('hot-aisle-01')
  })
})

describe('allocateFieldPort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue({ from: vi.fn().mockResolvedValue([]) })
    mockDb.query.devices.findMany.mockResolvedValue([])
  })

  it('returns the first free port in 5020–5999', async () => {
    mockIsHostPortAvailable.mockImplementation(async (port: number) => port !== 5020)
    const port = await allocateFieldPort()
    expect(port).toBe(5021)
  })

  it('skips ports already leased', async () => {
    mockDb.select.mockReturnValue({ from: vi.fn().mockResolvedValue([{ hostPort: 5020 }]) })
    mockIsHostPortAvailable.mockResolvedValue(true)
    const port = await allocateFieldPort()
    expect(port).toBe(5021)
  })
})
