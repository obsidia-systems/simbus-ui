import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDocker, containerMocks } = vi.hoisted(() => {
  const containerMocks = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({}),
    logs: vi.fn().mockResolvedValue(Buffer.alloc(0)),
  }

  const mockDocker = {
    createContainer: vi.fn(),
    createNetwork: vi.fn().mockResolvedValue(undefined),
    getContainer: vi.fn(() => containerMocks),
    listNetworks: vi.fn(),
    listContainers: vi.fn(),
  }

  return { mockDocker, containerMocks }
})

vi.mock('dockerode', () => ({
  default: function () {
    return mockDocker
  },
}))

import type { Device } from '@/db/schema'
import {
  createContainer,
  ensureNetwork,
  getContainerLogs,
  getContainerStatus,
  removeContainer,
  resolveApiUrl,
  startContainer,
  stopContainer,
  stripAnsi,
} from '@/lib/docker'

function makeDevice(overrides?: Partial<Device>): Device {
  return {
    id: 'dev-1',
    name: 'Test Device',
    presetId: 'builtin/generic-tnh-sensor',
    instancePath: '/tmp/instances/dev-1.yaml',
    yamlHash: 'abc123',
    dockerContainerId: 'abc123',
    dockerContainerName: 'simbus-tnh-test-device',
    tickInterval: 1.0,
    timeScale: 1.0,
    seed: null,
    desiredState: 'running',
    controlHostPort: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('ensureNetwork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DOCKER_NETWORK
  })

  it('creates the network when it does not exist', async () => {
    mockDocker.listNetworks.mockResolvedValue([{ Name: 'other-net' }])
    await ensureNetwork()
    expect(mockDocker.listNetworks).toHaveBeenCalledWith({
      filters: { name: ['simbus-net'] },
    })
  })

  it('does nothing when the network already exists', async () => {
    mockDocker.listNetworks.mockResolvedValue([{ Name: 'simbus-net' }])
    await ensureNetwork()
    expect(mockDocker.createNetwork).not.toHaveBeenCalled()
  })
})

describe('createContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SIMBUS_IMAGE
    delete process.env.DOCKER_NETWORK
    delete process.env.SIMBUS_UI_MODE
    delete process.env.SIMBUS_INSTANCE_VOLUME
    mockDocker.createContainer.mockResolvedValue({ id: 'container-id-xyz' })
    mockDocker.listNetworks.mockResolvedValue([{ Name: 'simbus-net' }])
  })

  it('creates a distroless file-only container without SIMBUS_DEVICE_TYPE', async () => {
    const id = await createContainer({
      id: 'dev-1',
      name: 'sensor-01',
      containerName: 'simbus-tnh-sensor-01',
      yamlHash: 'deadbeef',
      tickInterval: 1.0,
      timeScale: 1,
      leases: [{ containerPort: 502, hostPort: 5021, proto: 'tcp', published: true }],
      instancePath: '/tmp/instances/dev-1.yaml',
    })

    expect(id).toBe('container-id-xyz')
    const call = mockDocker.createContainer.mock.calls[0]![0]
    expect(call.User).toBe('65532:65532')
    expect(call.Image).toBe('ghcr.io/obsidia-systems/simbus:0.3.0')
    expect(call.Env).toEqual(
      expect.arrayContaining([
        'SIMBUS_YAML_PATH=/config/device.yaml',
        'SIMBUS_DEVICE_NAME=sensor-01',
        'SIMBUS_TICK_INTERVAL=1',
      ]),
    )
    expect(call.Env.join(' ')).not.toContain('SIMBUS_DEVICE_TYPE')
    expect(call.Labels).toEqual({
      'simbus.managed': 'true',
      'simbus.device-id': 'dev-1',
      'simbus.yaml-hash': 'deadbeef',
    })
    expect(call.HostConfig.ReadonlyRootfs).toBe(true)
    expect(call.HostConfig.CapDrop).toEqual(['ALL'])
    expect(call.HostConfig.CapAdd).toEqual(['NET_BIND_SERVICE'])
    expect(call.HostConfig.Binds).toEqual(['/tmp/instances/dev-1.yaml:/config/device.yaml:ro'])
    expect(call.HostConfig.PortBindings['8000/tcp']).toBeUndefined()
    expect(call.HostConfig.PortBindings['502/tcp']).toEqual([{ HostPort: '5021' }])
  })

  it('uses the named instance volume in docker-from-docker mode', async () => {
    process.env.SIMBUS_INSTANCE_VOLUME = 'simbus-data'
    await createContainer({
      id: 'dev-2',
      name: 'vol',
      containerName: 'simbus-tnh-vol',
      yamlHash: 'h',
      tickInterval: 1,
      timeScale: 1,
      leases: [],
    })
    const call = mockDocker.createContainer.mock.calls[0]![0]
    expect(call.HostConfig.Binds).toEqual(['simbus-data:/config-store:ro'])
    expect(call.Env).toContain('SIMBUS_YAML_PATH=/config-store/instances/dev-2.yaml')
  })

  it('binds control HTTP to loopback in host mode only', async () => {
    process.env.SIMBUS_UI_MODE = 'host'
    await createContainer({
      id: 'dev-3',
      name: 'hostdev',
      containerName: 'simbus-tnh-hostdev',
      yamlHash: 'h',
      tickInterval: 1,
      timeScale: 1,
      leases: [],
      controlHostPort: 8101,
      instancePath: '/tmp/instances/dev-3.yaml',
    })
    const call = mockDocker.createContainer.mock.calls[0]![0]
    expect(call.HostConfig.PortBindings['8000/tcp']).toEqual([
      { HostIp: '127.0.0.1', HostPort: '8101' },
    ])
  })

  it('includes seed env when provided', async () => {
    await createContainer({
      id: 'dev-4',
      name: 'seeded',
      containerName: 'simbus-tnh-seeded',
      yamlHash: 'h',
      tickInterval: 1,
      timeScale: 1,
      seed: 42,
      leases: [],
      instancePath: '/tmp/x.yaml',
    })
    const call = mockDocker.createContainer.mock.calls[0]![0]
    expect(call.Env).toContain('SIMBUS_SEED=42')
  })
})

describe('container lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('startContainer delegates to container.start', async () => {
    await startContainer('c-id')
    expect(containerMocks.start).toHaveBeenCalledOnce()
  })

  it('stopContainer swallows errors', async () => {
    containerMocks.stop.mockRejectedValue(new Error('already stopped'))
    await expect(stopContainer('c-id')).resolves.toBeUndefined()
  })

  it('removeContainer stops then removes with force', async () => {
    await removeContainer('c-id')
    expect(containerMocks.remove).toHaveBeenCalledWith({ force: true })
  })
})

describe('getContainerStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns running when State.Running is true', async () => {
    containerMocks.inspect.mockResolvedValue({ State: { Running: true, Error: '' } })
    expect(await getContainerStatus('c-id')).toBe('running')
  })

  it('returns unknown when inspect throws', async () => {
    containerMocks.inspect.mockRejectedValue(new Error('not found'))
    expect(await getContainerStatus('c-id')).toBe('unknown')
  })
})

describe('stripAnsi / logs', () => {
  it('removes color escape codes', () => {
    const colored = '\x1b[32m\x1b[1minfo\x1b[0m \x1b[36mapi_port\x1b[0m=\x1b[35m8000\x1b[0m'
    expect(stripAnsi(colored)).toBe('info api_port=8000')
  })

  it('strips Docker multiplex headers', async () => {
    const frame1 = Buffer.alloc(8 + 5)
    frame1.writeUInt8(1, 0)
    frame1.writeUInt32BE(5, 4)
    frame1.write('hello', 8)
    containerMocks.logs.mockResolvedValue(frame1)
    expect(await getContainerLogs('c-id', 50)).toBe('hello')
  })
})

describe('resolveApiUrl', () => {
  beforeEach(() => {
    delete process.env.SIMBUS_UI_MODE
  })

  it('uses container name in docker mode', () => {
    process.env.SIMBUS_UI_MODE = 'docker'
    expect(resolveApiUrl(makeDevice())).toBe('http://simbus-tnh-test-device:8000')
  })

  it('uses loopback in host mode when controlHostPort is set', () => {
    process.env.SIMBUS_UI_MODE = 'host'
    expect(resolveApiUrl(makeDevice({ controlHostPort: 8100 }))).toBe('http://127.0.0.1:8100')
  })

  it('throws in host mode without a loopback control port', () => {
    process.env.SIMBUS_UI_MODE = 'host'
    expect(() => resolveApiUrl(makeDevice())).toThrow(/loopback control port/)
  })
})
