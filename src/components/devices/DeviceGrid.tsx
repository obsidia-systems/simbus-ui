import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

import { DeviceCard } from './DeviceCard'

const queryClient = new QueryClient()

interface ApiDevice {
  id: string
  name: string
  type: string
  dockerContainerName: string
  internalModbusPort: number
  hostModbusPort: number | null
  hostApiPort: number | null
  tickInterval: number
  dockerStatus: 'running' | 'stopped' | 'error' | 'unknown'
}

function Grid() {
  const {
    data: devices,
    refetch,
    isLoading,
  } = useQuery<ApiDevice[]>({
    queryKey: ['devices'],
    queryFn: () => fetch('/api/devices').then((r) => r.json()),
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-pulse rounded-full"
              style={{
                background: 'var(--accent-cyan)',
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
        <p className="field-label">initializing</p>
      </div>
    )
  }

  if (!devices?.length) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-4 py-24">
        {/* Empty state illustration */}
        <div
          className="flex size-16 items-center justify-center rounded-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="size-8"
            style={{ color: 'var(--text-muted)' }}
          >
            <rect
              x="4"
              y="8"
              width="24"
              height="16"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M4 13h24" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="10.5" r="1" fill="currentColor" />
            <circle cx="11" cy="10.5" r="1" fill="currentColor" />
            <path d="M12 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            No devices running
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Create your first virtual field device to get started
          </p>
        </div>
        <a href="/devices/new" className="btn btn-primary mt-1">
          New Device
        </a>
      </div>
    )
  }

  const counts = {
    running: devices.filter((d) => d.dockerStatus === 'running').length,
    stopped: devices.filter((d) => d.dockerStatus === 'stopped').length,
    error: devices.filter((d) => d.dockerStatus === 'error').length,
  }

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      {/* Summary bar */}
      <div
        className="flex items-center gap-4 rounded-lg px-4 py-2.5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <span className="field-label mr-1">devices</span>
        <SummaryPill count={counts.running} label="running" color="var(--accent-green)" />
        <SummaryPill count={counts.stopped} label="stopped" color="var(--text-muted)" />
        {counts.error > 0 && (
          <SummaryPill count={counts.error} label="error" color="var(--accent-red)" />
        )}
        <div className="ml-auto">
          <a href="/devices/new" className="btn btn-primary text-xs">
            + New Device
          </a>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((device) => (
          <DeviceCard key={device.id} {...device} onStatusChange={() => refetch()} />
        ))}
      </div>
    </div>
  )
}

function SummaryPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mono-value text-xs" style={{ color, fontWeight: 600 }}>
        {count}
      </span>
      <span className="field-label">{label}</span>
    </div>
  )
}

export function DeviceGrid() {
  return (
    <QueryClientProvider client={queryClient}>
      <Grid />
    </QueryClientProvider>
  )
}
