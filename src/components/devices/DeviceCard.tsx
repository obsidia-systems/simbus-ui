import { actions } from 'astro:actions'

import { useState } from 'react'

import { getDeviceType } from '@/lib/device-types'

import { StatusBadge } from './StatusBadge'

// Device icons as minimal SVG paths — keyed by device type
const DEVICE_ICONS: Record<string, React.ReactNode> = {
  'generic-tnh-sensor': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v11.17A4 4 0 1 0 15 14.17V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6" />
    </svg>
  ),
  'generic-ups': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4M12 11v4M10 13h4" />
    </svg>
  ),
  'generic-pdu': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
      <circle cx="8" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <circle cx="16" cy="15" r="1.5" fill="currentColor" />
    </svg>
  ),
  'generic-crac': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 10 16H2m15.73-8.27A2 2 0 1 1 19 12H2"
      />
    </svg>
  ),
  'generic-power-meter': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  'generic-leak-sensor': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2c0 0-7 8.4-7 13a7 7 0 0 0 14 0c0-4.6-7-13-7-13z"
      />
    </svg>
  ),
  'generic-door-contact': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
      <circle cx="16" cy="13" r="1" fill="currentColor" />
    </svg>
  ),
}

type DockerStatus = 'running' | 'stopped' | 'error' | 'unknown'

interface DeviceCardProps {
  id: string
  name: string
  type: string
  dockerContainerName: string
  internalModbusPort: number
  hostModbusPort: number | null
  hostApiPort: number | null
  tickInterval: number
  dockerStatus: DockerStatus
  onStatusChange?: () => void
}

export function DeviceCard({
  id,
  name,
  type,
  dockerContainerName,
  internalModbusPort,
  hostModbusPort,
  hostApiPort,
  tickInterval,
  dockerStatus: initialStatus,
  onStatusChange,
}: DeviceCardProps) {
  const [status, setStatus] = useState<DockerStatus | 'creating'>(initialStatus)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const typeDef = getDeviceType(type)
  const icon = DEVICE_ICONS[type]

  async function handleStart() {
    setBusy(true)
    const { error } = await actions.devices.start({ id })
    if (!error) setStatus('running')
    setBusy(false)
    onStatusChange?.()
  }

  async function handleStop() {
    setBusy(true)
    const { error } = await actions.devices.stop({ id })
    if (!error) setStatus('stopped')
    setBusy(false)
    onStatusChange?.()
  }

  async function handleRemove() {
    setBusy(true)
    await actions.devices.remove({ id })
    onStatusChange?.()
  }

  return (
    <article className="panel group flex flex-col gap-0 overflow-hidden transition-colors hover:border-[var(--border-strong)]">
      {/* Top accent bar — colored by status */}
      <div
        className="h-0.5 w-full"
        style={{
          background:
            status === 'running'
              ? 'var(--accent-green)'
              : status === 'error'
                ? 'var(--accent-red)'
                : 'var(--border)',
        }}
      />

      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Icon */}
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-md"
              style={{
                background: 'var(--bg-overlay)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border)',
              }}
            >
              {icon}
            </div>

            <div className="min-w-0">
              <a
                href={`/devices/${id}`}
                className="truncate text-sm leading-tight font-semibold transition-colors hover:text-(--accent-cyan)"
                style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
              >
                {name}
              </a>
              <p
                className="truncate text-[0.7rem]"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {typeDef?.label ?? type}
              </p>
            </div>
          </div>

          <StatusBadge status={status} />
        </div>

        <hr className="dc-divider" />

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2">
          <MetaField label="Container" value={dockerContainerName} truncate />
          <MetaField label="Modbus port" value={String(hostModbusPort ?? internalModbusPort)} />
          <MetaField label="API port" value={hostApiPort ? String(hostApiPort) : '—'} />
          <MetaField label="Tick" value={`${tickInterval}s`} />
        </div>

        <hr className="dc-divider" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status === 'stopped' || status === 'unknown' ? (
            <button
              className="btn btn-success flex-1 text-xs"
              onClick={handleStart}
              disabled={busy}
            >
              Start
            </button>
          ) : (
            <button
              className="btn btn-ghost flex-1 text-xs"
              onClick={handleStop}
              disabled={busy || status === 'creating'}
            >
              Stop
            </button>
          )}

          {confirmRemove ? (
            <>
              <button className="btn btn-danger text-xs" onClick={handleRemove} disabled={busy}>
                Confirm
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost text-xs"
              onClick={() => setConfirmRemove(true)}
              disabled={busy}
              title="Remove device"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="size-3.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function MetaField({
  label,
  value,
  truncate,
}: {
  label: string
  value: string
  truncate?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="field-label">{label}</span>
      <span
        className={`mono-value ${truncate ? 'truncate' : ''}`}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  )
}
