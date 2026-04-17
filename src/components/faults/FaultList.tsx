import { actions } from 'astro:actions'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { ActiveFault } from '@/types/simbus'

interface Props {
  deviceId: string
}

const FAULT_COLORS: Record<string, string> = {
  spike: 'var(--accent-amber)',
  freeze: 'var(--accent-cyan)',
  dropout: 'var(--accent-red)',
  alarm: 'var(--accent-red)',
  noise_amplify: 'var(--accent-purple)',
}

export function FaultList({ deviceId }: Props) {
  const queryClient = useQueryClient()
  const [clearing, setClearing] = useState(false)

  const { data: faults = [], isLoading } = useQuery<ActiveFault[]>({
    queryKey: ['faults', deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${deviceId}/faults`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // Handle both { faults: [...] } and [...] response shapes
      return Array.isArray(json) ? json : (json.faults ?? [])
    },
    refetchInterval: 2000,
    retry: false,
  })

  async function handleClearAll() {
    setClearing(true)
    await actions.faults.clear({ deviceId })
    await queryClient.invalidateQueries({ queryKey: ['faults', deviceId] })
    setClearing(false)
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <h3
          className="text-[0.65rem] font-semibold tracking-wider uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Active Faults
          {faults.length > 0 && (
            <span
              className="ml-2 rounded-full px-1.5 py-0.5 font-mono"
              style={{
                background: 'var(--accent-red-dim)',
                color: 'var(--accent-red)',
                fontSize: '0.6rem',
              }}
            >
              {faults.length}
            </span>
          )}
        </h3>

        {faults.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="btn btn-ghost px-2 py-0.5 text-[0.65rem]"
            style={{ color: 'var(--accent-red)' }}
          >
            {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-1.5 py-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: 'var(--accent-cyan)', animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      ) : faults.length === 0 ? (
        <p className="py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          No active faults
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {faults.map((fault, i) => {
            const color = FAULT_COLORS[fault.fault_type] ?? 'var(--text-secondary)'
            const pct = fault.duration_s > 0 ? (fault.remaining_s / fault.duration_s) * 100 : 0
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded px-3 py-2"
                style={{ background: 'var(--bg-elevated)', border: `1px solid ${color}22` }}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: color, boxShadow: `0 0 4px ${color}88` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[0.65rem] font-semibold uppercase"
                      style={{ color }}
                    >
                      {fault.fault_type}
                    </span>
                    {fault.register_name && (
                      <span
                        className="mono-value text-[0.65rem]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {fault.register_name}
                      </span>
                    )}
                    {fault.value !== null && (
                      <span
                        className="mono-value text-[0.65rem]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        = {fault.value}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div
                    className="mt-1 h-0.5 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--border)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
                <span
                  className="mono-value shrink-0 text-[0.65rem]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {Math.ceil(fault.remaining_s)}s
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
