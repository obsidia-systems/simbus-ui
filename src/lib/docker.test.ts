import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockDocker, mockFs, containerMocks } = vi.hoisted(() => {
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

  const mockFs = {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  }

  return { mockDocker, mockFs, containerMocks }
})

// Use a regular function so `new Dockerode()` works in docker.ts
vi.mock('dockerode', () => ({
  default: function () {
    return mockDocker
  },
}))

vi.mock('node:fs/promises', () => ({
  default: mockFs,
}))

// ─── Imports ────────────────────────────────────────────────────────────────

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
  writeDeviceYaml,
} from '@/lib/docker'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDevice(overrides?: Partial<Device>): Device {
  return {
    id: 'dev-1',
    name: 'Test Device',
    type: 'generic-tnh-sensor',
    dockerContainerId: 'abc123',
    dockerContainerName: 'simbus-tnh-test-device',
    internalModbusPort: 502,
    internalApiPort: 8000,
    hostModbusPort: null,
    hostApiPort: null,
    tickInterval: 1.0,
    seed: null,
    yamlConfig: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

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
    expect(mockDocker.listNetworks).toHaveBeenCalledOnce()
  })
})

describe('writeDeviceYaml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes YAML to /app/configs/{id}.yaml', async () => {
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)

    await writeDeviceYaml('uuid-123', 'name: foo')

    expect(mockFs.mkdir).toHaveBeenCalledWith('/app/configs', { recursive: true })
    expect(mockFs.writeFile).toHaveBeenCalledWith('/app/configs/uuid-123.yaml', 'name: foo', 'utf8')
  })
})

describe('createContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SIMBUS_IMAGE
    delete process.env.DOCKER_NETWORK
    mockDocker.createContainer.mockResolvedValue({ id: 'container-id-xyz' })
  })

  it('creates a built-in type container without binds', async () => {
    const opts = {
      id: 'dev-1',
      name: 'sensor-01',
      type: 'generic-tnh-sensor',
      containerName: 'simbus-tnh-sensor-01',
      internalModbusPort: 502,
      internalApiPort: 8000,
      tickInterval: 1.0,
    }

    const id = await createContainer(opts)

    expect(id).toBe('container-id-xyz')
    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'simbus-tnh-sensor-01',
        Image: 'ghcr.io/obsidia-systems/simbus:latest',
        Env: expect.arrayContaining([
          'SIMBUS_TICK_INTERVAL=1',
          'SIMBUS_CORS_ORIGINS=["*"]',
          'SIMBUS_DEVICE_TYPE=generic-tnh-sensor',
          'SIMBUS_MODBUS_PORT=502',
          'SIMBUS_API_PORT=8000',
        ]),
        Labels: {
          'simbus.managed': 'true',
          'simbus.device-id': 'dev-1',
          'simbus.device-type': 'generic-tnh-sensor',
        },
        HostConfig: expect.objectContaining({
          NetworkMode: 'simbus-net',
          RestartPolicy: { Name: 'unless-stopped' },
          Binds: undefined,
        }),
      }),
    )
  })

  it('creates a custom type container with YAML bind', async () => {
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)

    const opts = {
      id: 'dev-2',
      name: 'custom-01',
      type: 'custom',
      containerName: 'simbus-custom-custom-01',
      internalModbusPort: 502,
      internalApiPort: 8000,
      tickInterval: 2.0,
      yamlConfig: 'name: my-device\nregisters: {}',
    }

    await createContainer(opts)

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/app/configs/dev-2.yaml',
      'name: my-device\nregisters: {}',
      'utf8',
    )
    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        Env: expect.arrayContaining(['SIMBUS_YAML_PATH=/app/configs/dev-2.yaml']),
        HostConfig: expect.objectContaining({
          Binds: ['simbus-configs:/app/configs:ro'],
        }),
      }),
    )
  })

  it('exposes host ports when provided', async () => {
    const opts = {
      id: 'dev-3',
      name: 'pub',
      type: 'generic-ups',
      containerName: 'simbus-ups-pub',
      internalModbusPort: 502,
      internalApiPort: 8000,
      hostModbusPort: 1502,
      hostApiPort: 18000,
      tickInterval: 1.0,
    }

    await createContainer(opts)

    const call = mockDocker.createContainer.mock.calls[0]![0]
    expect(call.ExposedPorts).toEqual({
      '502/tcp': {},
      '8000/tcp': {},
    })
    expect(call.HostConfig.PortBindings).toEqual({
      '502/tcp': [{ HostPort: '1502' }],
      '8000/tcp': [{ HostPort: '18000' }],
    })
  })

  it('includes seed env when provided', async () => {
    const opts = {
      id: 'dev-4',
      name: 'seeded',
      type: 'generic-pdu',
      containerName: 'simbus-pdu-seeded',
      internalModbusPort: 502,
      internalApiPort: 8000,
      tickInterval: 1.0,
      seed: 42,
    }

    await createContainer(opts)

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
    expect(mockDocker.getContainer).toHaveBeenCalledWith('c-id')
    expect(containerMocks.start).toHaveBeenCalledOnce()
  })

  it('stopContainer delegates to container.stop with 5s timeout', async () => {
    await stopContainer('c-id')
    expect(mockDocker.getContainer).toHaveBeenCalledWith('c-id')
    expect(containerMocks.stop).toHaveBeenCalledWith({ t: 5 })
  })

  it('stopContainer swallows errors', async () => {
    containerMocks.stop.mockRejectedValue(new Error('already stopped'))
    await expect(stopContainer('c-id')).resolves.toBeUndefined()
  })

  it('removeContainer stops then removes with force', async () => {
    await removeContainer('c-id')
    expect(mockDocker.getContainer).toHaveBeenCalledWith('c-id')
    expect(containerMocks.stop).toHaveBeenCalledWith({ t: 5 })
    expect(containerMocks.remove).toHaveBeenCalledWith({ force: true })
  })
})

describe('getContainerStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns running when State.Running is true', async () => {
    containerMocks.inspect.mockResolvedValue({ State: { Running: true, Error: '' } })
    const status = await getContainerStatus('c-id')
    expect(status).toBe('running')
  })

  it('returns error when State.Error is truthy', async () => {
    containerMocks.inspect.mockResolvedValue({ State: { Running: false, Error: 'boom' } })
    const status = await getContainerStatus('c-id')
    expect(status).toBe('error')
  })

  it('returns stopped otherwise', async () => {
    containerMocks.inspect.mockResolvedValue({ State: { Running: false, Error: '' } })
    const status = await getContainerStatus('c-id')
    expect(status).toBe('stopped')
  })

  it('returns unknown when inspect throws', async () => {
    containerMocks.inspect.mockRejectedValue(new Error('not found'))
    const status = await getContainerStatus('c-id')
    expect(status).toBe('unknown')
  })
})

describe('stripAnsi', () => {
  it('removes color escape codes', () => {
    const colored = '\x1b[32m\x1b[1minfo\x1b[0m \x1b[36mapi_port\x1b[0m=\x1b[35m8000\x1b[0m'
    expect(stripAnsi(colored)).toBe('info api_port=8000')
  })

  it('removes dim/italic codes', () => {
    const styled = '\x1b[2m2026-04-29T07:00:27.375Z\x1b[0m [info] started'
    expect(stripAnsi(styled)).toBe('2026-04-29T07:00:27.375Z [info] started')
  })

  it('returns plain text unchanged', () => {
    const plain = 'hello world'
    expect(stripAnsi(plain)).toBe('hello world')
  })

  it('handles mixed ANSI and plain text', () => {
    const mixed = 'Start\x1b[32mOK\x1b[0mEnd'
    expect(stripAnsi(mixed)).toBe('StartOKEnd')
  })
})

describe('getContainerLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('strips Docker multiplex headers and returns plain text', async () => {
    // Build a buffer with two frames:
    // Frame 1: stdout (type 1), size 5, payload "hello"
    // Frame 2: stderr (type 2), size 5, payload "world"
    const frame1 = Buffer.alloc(8 + 5)
    frame1.writeUInt8(1, 0) // stdout
    frame1.writeUInt32BE(5, 4) // size
    frame1.write('hello', 8)

    const frame2 = Buffer.alloc(8 + 5)
    frame2.writeUInt8(2, 0) // stderr
    frame2.writeUInt32BE(5, 4) // size
    frame2.write('world', 8)

    containerMocks.logs.mockResolvedValue(Buffer.concat([frame1, frame2]))

    const result = await getContainerLogs('c-id', 50)
    expect(result).toBe('helloworld')
    expect(containerMocks.logs).toHaveBeenCalledWith({
      stdout: true,
      stderr: true,
      tail: 50,
      timestamps: true,
    })
  })

  it('strips ANSI escape codes from log output', async () => {
    const payload = '\x1b[32m\x1b[1minfo\x1b[0m \x1b[36msimbus started\x1b[0m'
    const frame = Buffer.alloc(8 + payload.length)
    frame.writeUInt8(1, 0)
    frame.writeUInt32BE(payload.length, 4)
    frame.write(payload, 8)

    containerMocks.logs.mockResolvedValue(frame)

    const result = await getContainerLogs('c-id')
    expect(result).toBe('info simbus started')
  })

  it('handles an empty log buffer', async () => {
    containerMocks.logs.mockResolvedValue(Buffer.alloc(0))
    const result = await getContainerLogs('c-id')
    expect(result).toBe('')
  })
})

describe('resolveApiUrl', () => {
  const device = makeDevice()

  beforeEach(() => {
    delete process.env.SIMBUS_UI_MODE
  })

  it('uses container name in docker mode', () => {
    process.env.SIMBUS_UI_MODE = 'docker'
    const url = resolveApiUrl(device)
    expect(url).toBe('http://simbus-tnh-test-device:8000')
  })

  it('uses localhost in host mode when hostApiPort is set', () => {
    process.env.SIMBUS_UI_MODE = 'host'
    const d = makeDevice({ hostApiPort: 18000 })
    const url = resolveApiUrl(d)
    expect(url).toBe('http://localhost:18000')
  })

  it('throws in host mode without hostApiPort', () => {
    process.env.SIMBUS_UI_MODE = 'host'
    expect(() => resolveApiUrl(device)).toThrow(/has no hostApiPort set/)
  })

  it('defaults to host mode when env is unset', () => {
    const d = makeDevice({ hostApiPort: 9000 })
    const url = resolveApiUrl(d)
    expect(url).toBe('http://localhost:9000')
  })
})
