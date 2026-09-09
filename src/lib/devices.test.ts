import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDb, mockDocker, mockReconcile, mockFs } = vi.hoisted(() => {
  const mockDb = {
    query: {
      devices: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  }
  const mockDocker = {
    docker: {},
    getContainerLogs: vi.fn(),
    getContainerStatus: vi.fn(),
    removeContainer: vi.fn(),
    stopContainer: vi.fn(),
  }
  const mockReconcile = {
    reconcileDevice: vi.fn(),
    recreateDeviceContainer: vi.fn(),
  }
  const mockFs = { unlink: vi.fn() }
  return { mockDb, mockDocker, mockReconcile, mockFs }
})

vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/db/schema', () => ({
  devices: { id: 'id' },
  portLeases: { deviceId: 'deviceId' },
}))
vi.mock('@/lib/docker', () => mockDocker)
vi.mock('@/lib/reconciler', () => mockReconcile)
vi.mock('@/lib/catalog', () => ({ checkYamlFile: vi.fn(), readPresetYaml: vi.fn() }))
vi.mock('@/lib/leases', () => ({
  allocateControlPort: vi.fn(),
  allocateFieldPort: vi.fn(),
  replaceDeviceLeases: vi.fn(),
}))
vi.mock('@/lib/names', () => ({ containerNameBase: vi.fn(), nextUniqueName: vi.fn() }))
vi.mock('@/lib/paths', () => ({ instanceYamlPath: (id: string) => `/tmp/${id}.yaml` }))
vi.mock('@/lib/ports', () => ({ assertHostPortFree: vi.fn() }))
vi.mock('@/lib/runtime', () => ({ DEFAULT_MODBUS_PORT: 502, uiMode: () => 'docker' }))
vi.mock('@/lib/yaml', () => ({
  applyDeviceName: vi.fn(),
  extractConnectMeta: vi.fn(),
  hashYaml: vi.fn(),
  readInstanceYaml: vi.fn(),
  writeInstanceYaml: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ default: mockFs }))

import { clearSite, startAllDevices, stopAllDevices } from '@/lib/devices'

function chainUpdate() {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  })
}

function chainDelete() {
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  })
}

describe('site bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chainUpdate()
    chainDelete()
    mockDb.query.devices.findFirst.mockImplementation(async ({ where: _w }: unknown) => ({
      id: 'a',
      dockerContainerId: 'c1',
    }))
    mockFs.unlink.mockResolvedValue(undefined)
    mockDocker.stopContainer.mockResolvedValue(undefined)
    mockDocker.removeContainer.mockResolvedValue(undefined)
    mockReconcile.reconcileDevice.mockResolvedValue(undefined)
  })

  it('stopAllDevices stops each container and sets desired stopped', async () => {
    mockDb.query.devices.findMany.mockResolvedValue([
      { id: 'a', dockerContainerId: 'c1' },
      { id: 'b', dockerContainerId: null },
    ])
    const result = await stopAllDevices()
    expect(result).toEqual({ action: 'stop', ok: 2, failed: 0 })
    expect(mockDocker.stopContainer).toHaveBeenCalledTimes(1)
    expect(mockDocker.stopContainer).toHaveBeenCalledWith('c1')
  })

  it('startAllDevices reconciles every device as running', async () => {
    mockDb.query.devices.findMany.mockResolvedValue([
      { id: 'a', dockerContainerId: 'c1', desiredState: 'stopped' },
    ])
    const result = await startAllDevices()
    expect(result).toEqual({ action: 'start', ok: 1, failed: 0 })
    expect(mockReconcile.reconcileDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', desiredState: 'running' }),
    )
  })

  it('clearSite removes containers, rows, and yaml; continues after a failure', async () => {
    mockDb.query.devices.findMany.mockResolvedValue([
      { id: 'a', dockerContainerId: 'c1' },
      { id: 'b', dockerContainerId: 'c2' },
    ])
    mockDb.query.devices.findFirst
      .mockResolvedValueOnce({ id: 'a', dockerContainerId: 'c1' })
      .mockRejectedValueOnce(new Error('boom'))
    const result = await clearSite()
    expect(result.action).toBe('clear')
    expect(result.ok).toBe(1)
    expect(result.failed).toBe(1)
    expect(mockDocker.removeContainer).toHaveBeenCalledWith('c1')
    expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/a.yaml')
  })
})
