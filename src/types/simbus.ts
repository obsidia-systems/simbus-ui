/** Types for the simbus 0.3 control plane (docs/control.md). */

export interface SimbusStatus {
  name: string
  type: string
  modbus_port: number
  modbus_tls_port: number | null
  opcua_port: number | null
  bacnet_port: number | null
  tick_interval: number
  time_scale: number
  simulation: 'running' | 'stopped'
  modbus_server: 'listening' | 'stopped' | 'error'
}

export interface BindingInfo {
  protocol: string
  port: number | null
  unit_id: number | null
  endianness: string | null
  device_instance: number | null
  points: number | null
  implemented: boolean
}

export interface ScenarioInfo {
  id: string
  name: string
  description: string
  steps: number
  source: 'bundled' | 'session' | string
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
  spec_version: number
  bindings: BindingInfo[]
  scenarios: ScenarioInfo[]
  registers: RegisterMap
}

export interface PointLive {
  id: string
  kind: string
  class: string
  description: string
  unit: string
  value: number | boolean | null
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

export interface ScenarioActive {
  state: string
  scenario_name: string | null
  step_index: number
  total_steps: number
  elapsed_s: number
}

export interface FleetPointFrame {
  deviceId: string
  points: PointLive[]
}

export type FieldProtocol = 'modbus-tcp' | 'modbus-tls' | 'opcua' | 'bacnet-ip'

export interface PortLeaseDto {
  id: string
  protocol: string
  containerPort: number
  hostPort: number
  proto: 'tcp' | 'udp'
  published: boolean
}
