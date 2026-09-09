import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { apiSend, type DeviceRecord } from '@/app/api'
import { StatusBadge } from '@/components/devices/StatusBadge'
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

function alarms(points: PointLive[] | undefined): PointLive[] {
  return (points ?? []).filter((p) => p.kind === 'binary' && p.value === true)
}

export function DeviceCard({ device, points }: { device: DeviceRecord; points?: PointLive[] }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['devices'] })

  const start = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}/start`, 'POST'),
    onSuccess: invalidate,
  })
  const stop = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}/stop`, 'POST'),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: () => apiSend(`/api/devices/${device.id}`, 'DELETE'),
    onSuccess: invalidate,
  })

  const busy = start.isPending || stop.isPending || remove.isPending
  const hero = pickHero(points)
  const activeAlarms = alarms(points)
  const modbus = device.leases.find((l) => l.protocol === 'modbus-tcp' && l.published)
  const orphan = device.dockerStatus === 'unknown' && device.desiredState === 'running'

  return (
    <article className="panel group flex flex-col overflow-hidden transition-colors hover:border-[var(--border-strong)]">
      <div
        className="h-0.5 w-full"
        style={{
          background:
            device.dockerStatus === 'running'
              ? 'var(--accent-green)'
              : device.dockerStatus === 'error' || orphan
                ? 'var(--accent-red)'
                : 'var(--border)',
        }}
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/devices/$deviceId"
              params={{ deviceId: device.id }}
              className="truncate text-sm leading-tight font-semibold hover:text-(--accent-cyan)"
              style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
            >
              {device.name}
            </Link>
            <p className="truncate font-mono text-[0.7rem] text-[var(--text-secondary)]">
              {device.presetId ?? 'custom'} · {device.dockerContainerName}
            </p>
          </div>
          <StatusBadge status={orphan ? 'unknown' : device.dockerStatus} />
        </div>

        <div className="rounded-md bg-[var(--bg-overlay)] px-3 py-2">
          {hero ? (
            <div>
              <span className="field-label">{hero.description || hero.id}</span>
              <p className="mono-value text-lg">{formatPoint(hero)}</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              {device.dockerStatus === 'running' ? 'waiting for points…' : 'device stopped'}
            </p>
          )}
          {activeAlarms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {activeAlarms.map((a) => (
                <span
                  key={a.id}
                  className="rounded px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--accent-red)]"
                  style={{ background: 'var(--accent-red-dim)' }}
                >
                  {a.id}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="field-label">Modbus</span>
            <p className="mono-value">{modbus ? `:${modbus.hostPort}` : 'unpublished'}</p>
          </div>
          <div>
            <span className="field-label">Tick</span>
            <p className="mono-value">{device.tickInterval}s</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {device.dockerStatus === 'stopped' || device.dockerStatus === 'unknown' ? (
            <button
              className="btn btn-success flex-1 text-xs"
              disabled={busy}
              onClick={() => start.mutate()}
            >
              {orphan ? 'Recreate' : 'Start'}
            </button>
          ) : (
            <button
              className="btn btn-ghost flex-1 text-xs"
              disabled={busy}
              onClick={() => stop.mutate()}
            >
              Stop
            </button>
          )}
          <button
            className="btn btn-ghost text-xs"
            onClick={() => navigate({ to: '/devices/$deviceId', params: { deviceId: device.id } })}
          >
            Connect
          </button>
          {confirmRemove ? (
            <>
              <button
                className="btn btn-danger text-xs"
                disabled={busy}
                onClick={() => remove.mutate()}
              >
                Confirm
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost text-xs"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
