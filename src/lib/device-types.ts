export interface DeviceTypeDefinition {
  key: string
  label: string
  description: string
  defaultModbusPort: number
  icon: string // lucide icon name placeholder
}

export const DEVICE_TYPES: DeviceTypeDefinition[] = [
  {
    key: 'generic-tnh-sensor',
    label: 'T&H Sensor',
    description: 'Temperature & humidity sensor. Hot/cold aisle environmental monitoring.',
    defaultModbusPort: 502,
    icon: 'thermometer',
  },
  {
    key: 'generic-ups',
    label: 'UPS',
    description: 'Uninterruptible power supply. Battery level, voltage, load, runtime.',
    defaultModbusPort: 502,
    icon: 'battery-charging',
  },
  {
    key: 'generic-pdu',
    label: 'PDU',
    description: 'Power distribution unit. Per-outlet current, voltage, power, energy.',
    defaultModbusPort: 502,
    icon: 'plug',
  },
  {
    key: 'generic-crac',
    label: 'CRAC',
    description: 'Computer room air conditioning. Supply/return temp, humidity, fan speed.',
    defaultModbusPort: 502,
    icon: 'wind',
  },
  {
    key: 'generic-power-meter',
    label: 'Power Meter',
    description: 'High-precision AC power analyzer. Voltage, current, power factor, THD.',
    defaultModbusPort: 502,
    icon: 'zap',
  },
  {
    key: 'generic-leak-sensor',
    label: 'Leak Sensor',
    description: 'Water / leak detection sensor. Binary wet/dry state.',
    defaultModbusPort: 502,
    icon: 'droplets',
  },
  {
    key: 'generic-door-contact',
    label: 'Door Contact',
    description: 'Door or rack panel contact sensor. Binary open/closed state.',
    defaultModbusPort: 502,
    icon: 'door-open',
  },
]

export const DEVICE_TYPE_MAP = Object.fromEntries(DEVICE_TYPES.map((t) => [t.key, t]))

export function getDeviceType(key: string): DeviceTypeDefinition | undefined {
  return DEVICE_TYPE_MAP[key]
}
