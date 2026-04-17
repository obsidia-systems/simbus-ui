import { actions } from 'astro:actions'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { StatusBadge } from '@/components/devices/StatusBadge'
import { FaultList } from '@/components/faults/FaultList'
import { FaultPanel } from '@/components/faults/FaultPanel'
import { LogsViewer } from '@/components/logs/LogsViewer'
import { SimulationControls } from '@/components/simulation/SimulationControls'
import type { SimbusStatus } from '@/types/simbus'

import { RegisterTable } from './RegisterTable'

const queryClient = new QueryClient()

interface Props {
  deviceId: string
  deviceName: string
  deviceType: string
  dockerStatus: 'running' | 'stopped' | 'error' | 'unknown'
}

function Detail({ deviceId, deviceName, deviceType, dockerStatus }: Props) {
  const [containerStatus, setContainerStatus] = useState(dockerStatus)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { data: status } = useQuery<SimbusStatus>({
    queryKey: ['status', deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${deviceId}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<SimbusStatus>
    },
    enabled: containerStatus === 'running',
    refetchInterval: 3000,
    retry: false,
  })

  async function handleStop() {
    setBusy(true)
    await actions.devices.stop({ id: deviceId })
    setContainerStatus('stopped')
    setBusy(false)
  }

  async function handleStart() {
    setBusy(true)
    await actions.devices.start({ id: deviceId })
    setContainerStatus('running')
    setBusy(false)
  }

  async function handleRemove() {
    await actions.devices.remove({ id: deviceId })
    window.location.href = '/'
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* ── Device header ─────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 rounded-lg p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {deviceName}
            </h2>
            <p className="mono-value text-xs" style={{ color: 'var(--text-secondary)' }}>
              {deviceType}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={containerStatus} />
            {status && (
              <>
                <SimBadge
                  label="sim"
                  value={status.simulation}
                  activeColor="var(--accent-green)"
                  inactiveColor="var(--text-muted)"
                />
                <SimBadge
                  label="modbus"
                  value={status.modbus_server}
                  activeColor="var(--accent-cyan)"
                  inactiveColor={
                    status.modbus_server === 'error' ? 'var(--accent-red)' : 'var(--text-muted)'
                  }
                  activeValues={['listening']}
                />
              </>
            )}
          </div>
        </div>

        {status && (
          <div className="flex flex-wrap gap-4 pt-1">
            <MetaItem label="Modbus port" value={String(status.modbus_port)} />
            <MetaItem label="Tick interval" value={`${status.tick_interval}s`} />
            <MetaItem label="Unit ID" value="1" />
          </div>
        )}

        <div
          className="flex items-center gap-2 border-t pt-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {containerStatus === 'running' ? (
            <button className="btn btn-ghost text-xs" onClick={handleStop} disabled={busy}>
              Stop
            </button>
          ) : (
            <button className="btn btn-success text-xs" onClick={handleStart} disabled={busy}>
              Start
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {confirmRemove ? (
              <>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Remove device?
                </span>
                <button className="btn btn-danger text-xs" onClick={handleRemove}>
                  Confirm
                </button>
                <button className="btn btn-ghost text-xs" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost text-xs"
                style={{ color: 'var(--accent-red)' }}
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {containerStatus === 'running' ? (
        <>
          {/* ── Registers ─────────────────────────────────────────── */}
          <RegisterTable deviceId={deviceId} />

          {/* ── Simulation + Faults (side by side on wider screens) ─ */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Simulation">
              <SimulationControls deviceId={deviceId} tickInterval={status?.tick_interval ?? 1} />
            </Section>
            <Section title="Fault Injection">
              <FaultPanel deviceId={deviceId} />
            </Section>
          </div>

          {/* ── Active faults ─────────────────────────────────────── */}
          <FaultList deviceId={deviceId} />

          {/* ── Logs ──────────────────────────────────────────────── */}
          <Section title="Container Logs">
            <LogsViewer deviceId={deviceId} />
          </Section>
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg py-16"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Device is not running
          </p>
          <button className="btn btn-success text-xs" onClick={handleStart} disabled={busy}>
            Start Device
          </button>
        </div>
      )}
    </div>
  )
}

// ── Shared section wrapper ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-lg p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <h3
        className="text-[0.65rem] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--text-muted)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function SimBadge({
  label,
  value,
  activeColor,
  inactiveColor,
  activeValues = ['running', 'listening'],
}: {
  label: string
  value: string
  activeColor: string
  inactiveColor: string
  activeValues?: string[]
}) {
  const isActive = activeValues.includes(value)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
      style={{
        background: isActive ? `${activeColor}18` : 'var(--bg-overlay)',
        border: `1px solid ${isActive ? activeColor : 'var(--border)'}33`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: isActive ? activeColor : inactiveColor }}
      />
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: isActive ? activeColor : inactiveColor,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label} · {value}
      </span>
    </span>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="field-label">{label}</span>
      <span className="mono-value text-xs">{value}</span>
    </div>
  )
}

export function DeviceDetail(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <Detail {...props} />
    </QueryClientProvider>
  )
}
