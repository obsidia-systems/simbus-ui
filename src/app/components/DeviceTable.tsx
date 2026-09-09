import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { apiSend, type DeviceRecord } from '@/app/api'
import type { PointLive } from '@/types/simbus'

function formatPoint(point: PointLive): string {
  if (point.value === null || point.value === undefined) return '—'
  if (typeof point.value === 'boolean') return point.value ? 'ON' : 'off'
  const n = point.value
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return point.unit ? `${rounded} ${point.unit}` : rounded
}

function pickHero(points: PointLive[] | undefined): PointLive | undefined {
  if (!points?.length) return undefined
  return (
    points.find((p) => p.id === 'temperature') ??
    points.find((p) => p.kind === 'analog') ??
    points[0]
  )
}

export function alarmPoints(points: PointLive[] | undefined): PointLive[] {
  return (points ?? []).filter(
    (p) => p.kind === 'binary' && p.value === true && /alarm|fault|alert/.test(p.id),
  )
}

export function presetLabel(presetId: string | null): string {
  if (!presetId) return 'custom'
  return presetId.split('/').pop()?.replace(/^generic-/, '') ?? presetId
}

export function endpointOf(device: DeviceRecord): { host: string; port: number } | null {
  const lease = device.leases.find((l) => l.protocol === 'modbus-tcp' && l.published)
  if (!lease) return null
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return { host, port: lease.hostPort }
}

export function DeviceTable({
  devices,
  fleet,
}: {
  devices: DeviceRecord[]
  fleet: Record<string, PointLive[]> | undefined
}) {
  const [query, setQuery] = useState('')
  const [alarmsOnly, setAlarmsOnly] = useState(false)

  const filtered = devices.filter((device) => {
    const points = fleet?.[device.id]
    const alarms = alarmPoints(points)
    if (alarmsOnly && alarms.length === 0) return false
    if (!query.trim()) return true
    const ep = endpointOf(device)
    const hay = [
      device.name,
      device.presetId ?? '',
      presetLabel(device.presetId),
      ep ? `${ep.host}:${ep.port}` : '',
      String(device.unitId ?? ''),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="dc-input max-w-xs"
          placeholder="Filter name, type, port…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={alarmsOnly}
            onChange={(e) => setAlarmsOnly(e.target.checked)}
          />
          Alarms only
        </label>
        <span className="text-xs text-[var(--text-muted)]">{filtered.length} shown</span>
      </div>

      <div className="panel overflow-x-auto">
        <table className="site-table">
          <thead>
            <tr>
              <th>St</th>
              <th>Name</th>
              <th>Type</th>
              <th>Endpoint</th>
              <th>UID</th>
              <th>Live</th>
              <th>Alarm</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((device) => (
              <DeviceRow key={device.id} device={device} points={fleet?.[device.id]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DeviceRow({ device, points }: { device: DeviceRecord; points?: PointLive[] }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['devices'] })
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const start = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}/start`, 'POST'),
    onSuccess: invalidate,
  })
  const stop = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}/stop`, 'POST'),
    onSuccess: invalidate,
  })
  const recreate = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}/recreate`, 'POST'),
    onSuccess: () => {
      setMenuOpen(false)
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}`, 'DELETE'),
    onSuccess: invalidate,
  })

  const busy = start.isPending || stop.isPending || recreate.isPending || remove.isPending
  const hero = pickHero(points)
  const alarms = alarmPoints(points)
  const endpoint = endpointOf(device)
  const orphan = device.dockerStatus === 'unknown' && device.desiredState === 'running'
  const stopped = device.dockerStatus === 'stopped' || device.dockerStatus === 'unknown'

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmRemove(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  async function copyEndpoint() {
    if (!endpoint) return
    await navigator.clipboard.writeText(`${endpoint.host}:${endpoint.port}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <tr className={alarms.length > 0 ? 'site-table-alarm' : undefined}>
      <td>
        <span
          className={`status-dot ${orphan ? 'error' : device.dockerStatus}`}
          title={orphan ? 'not ready' : device.dockerStatus}
        />
      </td>
      <td>
        <Link
          to="/devices/$deviceId"
          params={{ deviceId: device.id }}
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-cyan)]"
          style={{ textDecoration: 'none' }}
        >
          {device.name}
        </Link>
      </td>
      <td className="text-[var(--text-secondary)]">{presetLabel(device.presetId)}</td>
      <td className="mono-value">{endpoint ? `${endpoint.host}:${endpoint.port}` : '—'}</td>
      <td className="mono-value">{device.unitId ?? '—'}</td>
      <td className="mono-value">{hero ? formatPoint(hero) : '—'}</td>
      <td>
        {alarms.length === 0 ? (
          <span className="text-[var(--text-muted)]">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {alarms.map((a) => (
              <span
                key={a.id}
                className="rounded px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--accent-red)]"
                style={{ background: 'var(--accent-red-dim)' }}
              >
                {a.id}
              </span>
            ))}
          </span>
        )}
      </td>
      <td>
        <div className="flex items-center justify-end gap-1">
          <button
            className="btn btn-ghost text-xs"
            disabled={!endpoint}
            onClick={() => void copyEndpoint()}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {stopped ? (
            <button
              className="btn btn-success text-xs"
              disabled={busy}
              onClick={() => start.mutate()}
            >
              {orphan ? 'Recreate' : 'Start'}
            </button>
          ) : (
            <button className="btn btn-ghost text-xs" disabled={busy} onClick={() => stop.mutate()}>
              Stop
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              className="btn btn-ghost px-2 text-xs"
              aria-label="More actions"
              onClick={() => {
                setMenuOpen((o) => !o)
                setConfirmRemove(false)
              }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
                <button
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                  disabled={busy}
                  onClick={() => recreate.mutate()}
                >
                  Recreate
                </button>
                {confirmRemove ? (
                  <div className="flex gap-1 p-1">
                    <button
                      className="btn btn-danger flex-1 text-xs"
                      disabled={busy}
                      onClick={() => remove.mutate()}
                    >
                      Delete
                    </button>
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-[var(--accent-red)] hover:bg-[var(--accent-red-dim)]"
                    onClick={() => setConfirmRemove(true)}
                  >
                    Remove…
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
