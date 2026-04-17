// Types derived from the simbus OpenAPI spec

export interface SimbusStatus {
  name: string
  type: string
  modbus_port: number
  tick_interval: number
  simulation: 'running' | 'stopped'
  modbus_server: 'listening' | 'stopped' | 'error'
}

export interface RegisterInfo {
  address: number
  name: string
  description: string
  unit: string
  scale: number
  data_type: string
  default: number
  behavior: string | null
}

export interface CoilInfo {
  address: number
  name: string
  description: string
  default: boolean
}

export interface RegisterMap {
  holding: RegisterInfo[]
  input: RegisterInfo[]
  coils: CoilInfo[]
  discrete: CoilInfo[]
}

export interface SimbusConfig {
  name: string
  version: string
  type: string
  description: string
  modbus_port: number
  unit_id: number
  endianness: string
  registers: RegisterMap
}

export interface RegisterSnapshot {
  holding: Record<number, number>
  input: Record<number, number>
  coils: Record<number, boolean>
  discrete: Record<number, boolean>
}

export interface ActiveFault {
  fault_type: string
  register_name: string | null
  value: number | null
  duration_s: number
  remaining_s: number
}

export type FaultType = 'spike' | 'freeze' | 'dropout' | 'alarm' | 'noise_amplify'
