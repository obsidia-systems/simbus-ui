import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_SIMBUS_IMAGE, publishedPortBindings, simbusImage, yamlBind } from '@/lib/runtime'

describe('yamlBind', () => {
  afterEach(() => {
    delete process.env.SIMBUS_INSTANCE_VOLUME
  })

  it('bind-mounts the instance file on the host', () => {
    const bind = yamlBind('abc', '/data/instances/abc.yaml')
    expect(bind.binds).toEqual(['/data/instances/abc.yaml:/config/device.yaml:ro'])
    expect(bind.yamlPathInContainer).toBe('/config/device.yaml')
  })

  it('uses a named volume for Docker-from-Docker', () => {
    process.env.SIMBUS_INSTANCE_VOLUME = 'simbus-data'
    const bind = yamlBind('abc', '/app/data/instances/abc.yaml')
    expect(bind.binds).toEqual(['simbus-data:/config-store:ro'])
    expect(bind.yamlPathInContainer).toBe('/config-store/instances/abc.yaml')
  })
})

describe('publishedPortBindings', () => {
  afterEach(() => {
    delete process.env.SIMBUS_UI_MODE
  })

  it('does not publish 8000 in docker mode', () => {
    process.env.SIMBUS_UI_MODE = 'docker'
    const { portBindings } = publishedPortBindings(
      [{ containerPort: 502, hostPort: 5021, proto: 'tcp', published: true }],
      8100,
    )
    expect(portBindings['8000/tcp']).toBeUndefined()
    expect(portBindings['502/tcp']).toEqual([{ HostPort: '5021' }])
  })
})

describe('simbusImage', () => {
  afterEach(() => {
    delete process.env.SIMBUS_IMAGE
  })

  it('defaults to the pinned 0.3.0 engine', () => {
    expect(DEFAULT_SIMBUS_IMAGE).toBe('ghcr.io/obsidia-systems/simbus:0.3.0')
    expect(simbusImage()).toBe('ghcr.io/obsidia-systems/simbus:0.3.0')
  })

  it('honors SIMBUS_IMAGE when set', () => {
    process.env.SIMBUS_IMAGE = 'ghcr.io/obsidia-systems/simbus:0.4.0'
    expect(simbusImage()).toBe('ghcr.io/obsidia-systems/simbus:0.4.0')
  })
})
