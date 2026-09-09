import { describe, expect, it } from 'vitest'

import { applyDeviceName, extractConnectMeta, hashYaml } from '@/lib/yaml'

describe('extractConnectMeta', () => {
  it('reads unit_id from the modbus-tcp binding', () => {
    const yaml = `
name: x
bindings:
  - protocol: modbus-tcp
    unit_id: 1
    port: 502
`
    expect(extractConnectMeta(yaml).unitId).toBe(1)
  })
})

describe('hashYaml', () => {
  it('is stable for the same document', () => {
    expect(hashYaml('name: a\n')).toBe(hashYaml('name: a\n'))
    expect(hashYaml('name: a\n')).not.toBe(hashYaml('name: b\n'))
  })
})

describe('applyDeviceName', () => {
  it('replaces the existing name field', () => {
    const next = applyDeviceName('name: "Generic T&H Sensor"\nspec_version: 2\n', 'hot-aisle-01')
    expect(next).toMatch(/^name: "hot-aisle-01"/m)
    expect(next).toContain('spec_version: 2')
  })
})
