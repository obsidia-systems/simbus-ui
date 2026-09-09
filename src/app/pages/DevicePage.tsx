import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { apiGet, apiSend, type DeviceRecord } from '@/app/api'
import { ConnectPanel } from '@/app/components/ConnectPanel'
import { FaultsPanel } from '@/app/components/FaultsPanel'
import { PointsTable } from '@/app/components/PointsTable'
import { ScenariosPanel } from '@/app/components/ScenariosPanel'
import { usePointsStream } from '@/app/hooks/usePointsStream'
import { StatusBadge } from '@/components/devices/StatusBadge'
import type { PointLive, SimbusConfig, SimbusStatus } from '@/types/simbus'

export function DevicePage() {
  const { deviceId } = useParams({ from: '/devices/$deviceId' })
  const queryClient = useQueryClient()
  const [pauseBusy, setPauseBusy] = useState(false)

  const device = useQuery({
    queryKey: ['devices', deviceId],
    queryFn: () => apiGet<DeviceRecord>(`/api/devices/${deviceId}`),
  })
  const status = useQuery({
    queryKey: ['status', deviceId],
    queryFn: () => apiGet<SimbusStatus>(`/api/devices/${deviceId}/status`),
    refetchInterval: 4000,
    retry: false,
  })
  const config = useQuery({
    queryKey: ['config', deviceId],
    queryFn: () => apiGet<SimbusConfig>(`/api/devices/${deviceId}/config`),
    retry: false,
  })
  const points = useQuery({
    queryKey: ['points', deviceId],
    queryFn: () => apiGet<PointLive[]>(`/api/devices/${deviceId}/points`),
    retry: false,
  })
  const readyz = useQuery({
    queryKey: ['readyz', deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${deviceId}/readyz`)
      return { ok: res.ok, status: res.status }
    },
    refetchInterval: 4000,
  })
  const logs = useQuery({
    queryKey: ['logs', deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${deviceId}/logs`)
      return res.text()
    },
  })

  usePointsStream(deviceId, device.data?.dockerStatus === 'running')

  const recreate = useMutation({
    mutationFn: () => apiSend(`/api/devices/${deviceId}/recreate`, 'POST'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })

  async function setRunning(running: boolean) {
    setPauseBusy(true)
    try {
      await apiSend(`/api/devices/${deviceId}/simulation`, 'PATCH', { running })
      await queryClient.invalidateQueries({ queryKey: ['status', deviceId] })
      await queryClient.invalidateQueries({ queryKey: ['readyz', deviceId] })
    } finally {
      setPauseBusy(false)
    }
  }

  if (device.isLoading) return <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
  if (!device.data) return <p className="text-sm text-[var(--accent-red)]">Device not found.</p>

  const row = device.data
  const sim = status.data?.simulation
  const degraded = readyz.data && !readyz.data.ok

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/" className="field-label mb-1 inline-block">
            ← site
          </Link>
          <h1 className="text-xl font-semibold">{row.name}</h1>
          <p className="font-mono text-xs text-[var(--text-secondary)]">
            {row.dockerContainerName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={row.dockerStatus} />
          {degraded && (
            <span className="text-xs text-[var(--accent-amber)]">
              readyz 503 (paused or starting)
            </span>
          )}
          <button className="btn btn-ghost text-xs" onClick={() => recreate.mutate()}>
            Recreate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta label="Sim" value={sim ?? '—'} />
        <Meta label="Modbus" value={status.data?.modbus_server ?? '—'} />
        <Meta label="Tick" value={`${status.data?.tick_interval ?? row.tickInterval}s`} />
        <Meta label="Listeners" value={fieldListeners(status.data)} />
      </div>

      <ConnectPanel device={row} config={config.data} />

      <div className="panel p-4">
        <p className="field-label mb-3">Points</p>
        <h2 className="mb-3 text-sm font-semibold">Live</h2>
        <PointsTable deviceId={deviceId} points={points.data ?? []} config={config.data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScenariosPanel deviceId={deviceId} />
        <FaultsPanel deviceId={deviceId} />
      </div>

      <div className="panel p-4">
        <p className="field-label">Simulation</p>
        <h2 className="mb-3 text-sm font-semibold">Pause / resume</h2>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost text-xs"
            disabled={pauseBusy}
            onClick={() => void setRunning(false)}
          >
            Pause
          </button>
          <button
            className="btn btn-success text-xs"
            disabled={pauseBusy}
            onClick={() => void setRunning(true)}
          >
            Resume
          </button>
        </div>
      </div>

      <div className="panel p-4">
        <p className="field-label">Logs</p>
        <h2 className="mb-3 text-sm font-semibold">Docker (no exec)</h2>
        <pre className="max-h-64 overflow-auto rounded-md bg-[var(--bg-overlay)] p-3 font-mono text-[0.7rem] text-[var(--text-secondary)]">
          {logs.data || 'No logs.'}
        </pre>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <span className="field-label">{label}</span>
      <p className="mono-value">{value}</p>
    </div>
  )
}

function fieldListeners(status?: SimbusStatus): string {
  if (!status) return '—'
  const ports = [
    status.modbus_port,
    status.modbus_tls_port,
    status.opcua_port,
    status.bacnet_port,
  ].filter((p): p is number => p != null)
  return ports.join(', ') || '—'
}
