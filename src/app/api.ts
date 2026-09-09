import type { PortLeaseDto } from '@/types/simbus'

export type DockerStatus = 'running' | 'stopped' | 'error' | 'unknown'

export interface DeviceRecord {
  id: string
  name: string
  presetId: string | null
  instancePath: string
  yamlHash: string
  dockerContainerId: string | null
  dockerContainerName: string
  tickInterval: number
  timeScale: number
  seed: number | null
  desiredState: 'running' | 'stopped'
  controlHostPort: number | null
  createdAt: number
  dockerStatus: DockerStatus
  leases: PortLeaseDto[]
  unitId: number | null
}

export interface CatalogPreset {
  id: string
  source: 'builtin' | 'community'
  filename: string
  name: string
  description: string
  type: string
  yamlPath: string
}

export interface TemplateDraft {
  id: string
  name: string
  description: string | null
  sourcePresetId: string | null
  yamlConfig: string
  createdAt: number
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    return JSON.stringify(body.detail ?? res.statusText)
  } catch {
    return res.statusText
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) throw new Error(await parseError(res))
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) return res.json() as Promise<T>
  return (await res.text()) as T
}
