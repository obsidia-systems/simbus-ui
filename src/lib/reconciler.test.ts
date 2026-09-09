import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDockerFns, mockDb } = vi.hoisted(() => {
  const mockDockerFns = {
    inspectContainer: vi.fn(),
    startContainer: vi.fn(),
    stopContainer: vi.fn(),
    removeContainer: vi.fn(),
    createContainer: vi.fn(),
    yamlHashFromInspect: vi.fn(),
  }
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  }
  return { mockDockerFns, mockDb }
})

vi.mock('@/lib/docker', () => mockDockerFns)
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/db/schema', () => ({
  devices: { id: 'id', dockerContainerId: 'dockerContainerId' },
  portLeases: { deviceId: 'device_id' },
}))

import type { Device } from '@/db/schema'
import { reconcileDevice } from '@/lib/reconciler'

function device(overrides?: Partial<Device>): Device {
  return {
    id: 'd1',
    name: 'n',
    presetId: 'builtin/generic-tnh-sensor',
    instancePath: '/tmp/d1.yaml',
    yamlHash: 'hash-1',
    dockerContainerId: 'cid',
    dockerContainerName: 'simbus-tnh-n',
    tickInterval: 1,
    timeScale: 1,
    seed: null,
    desiredState: 'running',
    controlHostPort: null,
    createdAt: 1,
    ...overrides,
  }
}

describe('reconcileDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    })
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    })
    mockDockerFns.createContainer.mockResolvedValue('new-cid')
    mockDockerFns.startContainer.mockResolvedValue(undefined)
    mockDockerFns.removeContainer.mockResolvedValue(undefined)
  })

  it('recreates when the container is missing', async () => {
    mockDockerFns.inspectContainer.mockRejectedValue(new Error('nope'))
    const action = await reconcileDevice(device())
    expect(action).toBe('orphan-recreated')
    expect(mockDockerFns.createContainer).toHaveBeenCalled()
  })

  it('recreates when yaml hash mismatches', async () => {
    mockDockerFns.inspectContainer.mockResolvedValue({
      State: { Running: true },
      Config: { Labels: {} },
    })
    mockDockerFns.yamlHashFromInspect.mockReturnValue('other')
    const action = await reconcileDevice(device())
    expect(action).toBe('recreated')
  })

  it('starts a desired-running container that is stopped', async () => {
    mockDockerFns.inspectContainer.mockResolvedValue({
      State: { Running: false },
      Config: { Labels: {} },
    })
    mockDockerFns.yamlHashFromInspect.mockReturnValue('hash-1')
    const action = await reconcileDevice(device())
    expect(action).toBe('started')
    expect(mockDockerFns.startContainer).toHaveBeenCalledWith('cid')
  })
})
