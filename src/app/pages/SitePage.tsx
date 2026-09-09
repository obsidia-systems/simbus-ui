import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { apiGet, type DeviceRecord } from '@/app/api'
import { DeviceCard } from '@/app/components/DeviceCard'
import { type FleetMap, useFleetStream } from '@/app/hooks/useFleetStream'
import type { PointLive } from '@/types/simbus'

export function SitePage() {
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet<DeviceRecord[]>('/api/devices'),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="field-label mb-1">site</p>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Devices
          </h1>
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

      <div className="grid grid-cols-3 gap-3">
        <Summary label="Running" value={String(running)} />
        <Summary label="Stopped" value={String(stopped)} />
        <Summary label="Not ready" value={String(notReady)} />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((device) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DeviceCard
                device={device}
                points={fleet.data?.[device.id] as PointLive[] | undefined}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <span className="field-label">{label}</span>
      <p className="mono-value text-lg">{value}</p>
    </div>
  )
}
