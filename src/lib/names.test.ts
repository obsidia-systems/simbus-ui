import { describe, expect, it } from 'vitest'

import { containerNameBase, nextUniqueName, slugify } from '@/lib/names'

describe('slugify', () => {
  it('slugifies device names', () => {
    expect(slugify('Hot Aisle 01')).toBe('hot-aisle-01')
  })
})

describe('containerNameBase', () => {
  it('follows simbus-{preset-short}-{slug}', () => {
    expect(containerNameBase('builtin/generic-tnh-sensor', 'Hot Aisle 01')).toBe(
      'simbus-tnh-sensor-hot-aisle-01',
    )
  })
})

describe('nextUniqueName', () => {
  it('returns the base when it is free', () => {
    expect(nextUniqueName('simbus-tnh-sensor-hot-aisle', [])).toBe('simbus-tnh-sensor-hot-aisle')
  })

  it('appends -2, -3 when the name is taken', () => {
    const taken = ['simbus-tnh-sensor-generic-t-h-sensor']
    expect(nextUniqueName('simbus-tnh-sensor-generic-t-h-sensor', taken)).toBe(
      'simbus-tnh-sensor-generic-t-h-sensor-2',
    )
    expect(
      nextUniqueName('simbus-tnh-sensor-generic-t-h-sensor', [
        ...taken,
        'simbus-tnh-sensor-generic-t-h-sensor-2',
      ]),
    ).toBe('simbus-tnh-sensor-generic-t-h-sensor-3')
  })
})
