import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { apiGet, type DeviceRecord } from '@/app/api'
import { alarmPoints, DeviceTable } from '@/app/components/DeviceTable'
import { LabActions } from '@/app/components/LabActions'
import { type FleetMap, useFleetStream } from '@/app/hooks/useFleetStream'

export function SitePage() {
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet<DeviceRecord[]>('/api/devices'),
    refetchOnMount: 'always',
  })
  const fleet = useQuery({
    queryKey: ['fleet'],
    queryFn: async () => ({}) as FleetMap,
    staleTime: Infinity,
  })
  useFleetStream()

  const rows = devices.data ?? []
  const running = rows.filter((d) => d.dockerStatus === 'running').length
  const stopped = rows.filter((d) => d.dockerStatus === 'stopped').length
  const notReady = rows.filter(
    (d) => d.dockerStatus === 'unknown' || d.dockerStatus === 'error',
  ).length
  const alarming = rows.filter((d) => alarmPoints(fleet.data?.[d.id]).length > 0).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="field-label mb-1">site</p>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Devices
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            Field slaves on this host. Copy the endpoint into your BMS; open a row for points,
            scenarios, and the Ignition map.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="status-dot running" style={{ ['--dot-md' as string]: '6px' }} />
            <span className="field-label">live points</span>
          </span>
          <Link to="/devices/new" className="btn btn-primary text-xs">
            New from preset
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-[var(--accent-green)]">{running} running</span>
          <span className="text-[var(--text-secondary)]">{stopped} stopped</span>
          {notReady > 0 && <span className="text-[var(--accent-amber)]">{notReady} not ready</span>}
          {alarming > 0 && <span className="text-[var(--accent-red)]">{alarming} alarm</span>}
        </div>
        {rows.length > 0 && <LabActions devices={rows} />}
      </div>

      {devices.isLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading devices…</p>
      ) : rows.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No devices on this site yet.</p>
          <Link to="/devices/new" className="btn btn-primary mt-4 text-xs">
            Deploy a T&H preset
          </Link>
        </div>
      ) : (
        <DeviceTable devices={rows} fleet={fleet.data} />
      )}
    </div>
  )
}
