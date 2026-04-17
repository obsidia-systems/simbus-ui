import { actions } from 'astro:actions'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { CoilInfo, RegisterInfo, SimbusConfig } from '@/types/simbus'

import { useRegisterStream } from './useRegisterStream'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scaleValue(raw: number, scale: number): string {
  return scale > 1 ? (raw / scale).toFixed(Math.ceil(Math.log10(scale))) : String(raw)
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

type Tab = 'holding' | 'input' | 'coils' | 'discrete'

const TAB_LABELS: Record<Tab, string> = {
  holding: 'Holding',
  input: 'Input',
  coils: 'Coils',
  discrete: 'Discrete',
}

// ─── Holding / Input row ─────────────────────────────────────────────────────

function AnalogRow({
  info,
  rawValue,
  deviceId,
  type,
}: {
  info: RegisterInfo
  rawValue: number | undefined
  deviceId: string
  type: 'holding' | 'input'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)

  const scaled = rawValue !== undefined ? scaleValue(rawValue, info.scale) : '—'
  const prevRaw = rawValue

  // flash animation on value change
  if (rawValue !== prevRaw) {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  async function submitOverride() {
    const num = parseFloat(draft)
    if (isNaN(num)) return
    setBusy(true)
    const action =
      type === 'holding' ? actions.registers.overrideHolding : actions.registers.overrideInput
    await action({ deviceId, address: info.address, real_value: num })
    setBusy(false)
    setEditing(false)
    setDraft('')
  }

  return (
    <tr
      className="group border-b transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* Address */}
      <td className="mono-value px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {info.address}
      </td>

      {/* Name + description */}
      <td className="px-3 py-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {info.name}
        </p>
        {info.description && (
          <p className="text-[0.65rem]" style={{ color: 'var(--text-muted)' }}>
            {info.description}
          </p>
        )}
      </td>

      {/* Raw value */}
      <td className="mono-value px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {rawValue ?? '—'}
      </td>

      {/* Scaled value */}
      <td
        className="mono-value px-3 py-2 text-sm font-medium"
        style={{
          color: flash ? 'var(--accent-amber)' : 'var(--text-mono)',
          transition: 'color 0.4s',
        }}
      >
        {scaled}
      </td>

      {/* Unit */}
      <td className="field-label px-3 py-2">{info.unit || '—'}</td>

      {/* Behavior */}
      <td className="px-3 py-2">
        {info.behavior && (
          <span
            className="inline-block rounded px-1.5 py-0.5 font-mono text-[0.6rem]"
            style={{
              background: 'var(--accent-purple-dim)',
              color: 'var(--accent-purple)',
              border: '1px solid var(--accent-purple)22',
            }}
          >
            {info.behavior}
          </span>
        )}
      </td>

      {/* Override */}
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="any"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitOverride()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="dc-input h-6 w-20 px-1.5 py-0 text-xs"
              placeholder={scaled}
            />
            <button
              onClick={submitOverride}
              disabled={busy}
              className="btn btn-success px-1.5 py-0.5 text-[0.65rem]"
            >
              ✓
            </button>
            <button
              onClick={() => setEditing(false)}
              className="btn btn-ghost px-1.5 py-0.5 text-[0.65rem]"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditing(true)
              setDraft(scaled)
            }}
            className="btn btn-ghost px-2 py-0.5 text-[0.65rem] opacity-0 transition-opacity group-hover:opacity-100"
          >
            override
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Coil / Discrete row ─────────────────────────────────────────────────────

function BoolRow({
  info,
  value,
  deviceId,
  type,
}: {
  info: CoilInfo
  value: boolean | undefined
  deviceId: string
  type: 'coils' | 'discrete'
}) {
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (value === undefined) return
    setBusy(true)
    const action =
      type === 'coils' ? actions.registers.overrideCoil : actions.registers.overrideDiscrete
    await action({ deviceId, address: info.address, value: !value })
    setBusy(false)
  }

  const isTrue = value === true

  return (
    <tr className="group border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <td className="mono-value px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {info.address}
      </td>

      <td className="px-3 py-2" colSpan={4}>
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {info.name}
        </p>
        {info.description && (
          <p className="text-[0.65rem]" style={{ color: 'var(--text-muted)' }}>
            {info.description}
          </p>
        )}
      </td>

      <td className="px-3 py-2" colSpan={2}>
        <button
          onClick={toggle}
          disabled={busy || value === undefined}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-semibold transition-all"
          style={{
            background: isTrue ? 'var(--accent-green-dim)' : 'var(--bg-overlay)',
            border: `1px solid ${isTrue ? 'var(--accent-green)' : 'var(--border)'}`,
            color: isTrue ? 'var(--accent-green)' : 'var(--text-muted)',
            cursor: type === 'coils' ? 'pointer' : 'default',
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: isTrue ? 'var(--accent-green)' : 'var(--text-muted)' }}
          />
          {value === undefined ? '—' : isTrue ? 'TRUE' : 'FALSE'}
        </button>
      </td>
    </tr>
  )
}

// ─── Table header ─────────────────────────────────────────────────────────────

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        {cols.map((c, i) => (
          <th
            key={i}
            className="field-label px-3 py-2 text-left"
            style={{ background: 'var(--bg-elevated)' }}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ─── Main RegisterTable ───────────────────────────────────────────────────────

interface Props {
  deviceId: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function RegisterTable({ deviceId }: Props) {
  const [tab, setTab] = useState<Tab>('holding')

  const {
    data: config,
    isLoading,
    error,
  } = useQuery<SimbusConfig>({
    queryKey: ['config', deviceId],
    queryFn: () => fetchJson<SimbusConfig>(`/api/devices/${deviceId}/config`),
    staleTime: Infinity,
    retry: false,
  })

  const { snapshot, state } = useRegisterStream(deviceId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full"
            style={{ background: 'var(--accent-cyan)', animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    )
  }

  if (error || !config?.registers) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg py-10 text-center"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-red)33' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>
          Device API unreachable
        </p>
        <p className="max-w-sm text-xs" style={{ color: 'var(--text-secondary)' }}>
          {(error as Error)?.message ?? 'Could not load register config'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Running in host mode? Re-create the device with{' '}
          <span className="mono-value">Expose API port</span> enabled.
        </p>
      </div>
    )
  }

  const registers = config.registers
  const tabs: Tab[] = ['holding', 'input', 'coils', 'discrete']
  const counts: Record<Tab, number> = {
    holding: registers.holding.length,
    input: registers.input.length,
    coils: registers.coils.length,
    discrete: registers.discrete.length,
  }

  return (
    <div
      className="flex flex-col gap-0 overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Tab bar + stream state */}
      <div
        className="flex items-center justify-between px-1 pt-1"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: tab === t ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: 'transparent',
                cursor: 'pointer',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              }}
            >
              {TAB_LABELS[t]}
              <span
                className="mono-value text-[0.6rem]"
                style={{ color: tab === t ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* SSE stream state indicator */}
        <div className="flex items-center gap-1.5 pr-3">
          <span
            className="size-1.5 rounded-full"
            style={{
              background:
                state === 'live'
                  ? 'var(--accent-green)'
                  : state === 'connecting'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-red)',
              boxShadow: state === 'live' ? 'var(--accent-green-glow)' : 'none',
            }}
          />
          <span className="field-label" style={{ fontSize: '0.6rem' }}>
            {state === 'live' ? 'live' : state === 'connecting' ? 'connecting…' : 'reconnecting…'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ background: 'var(--bg-surface)' }}>
        {(tab === 'holding' || tab === 'input') && (
          <table className="w-full text-sm">
            <TableHead cols={['Addr', 'Name', 'Raw', 'Value', 'Unit', 'Behavior', '']} />
            <tbody>
              {registers[tab].map((reg) => (
                <AnalogRow
                  key={reg.address}
                  info={reg}
                  rawValue={snapshot?.[tab]?.[reg.address]}
                  deviceId={deviceId}
                  type={tab}
                />
              ))}
              {registers[tab].length === 0 && (
                <tr>
                  <td colSpan={7} className="field-label px-3 py-6 text-center">
                    No {tab} registers defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {(tab === 'coils' || tab === 'discrete') && (
          <table className="w-full text-sm">
            <TableHead cols={['Addr', 'Name', '', '', '', '', 'State']} />
            <tbody>
              {registers[tab].map((coil) => (
                <BoolRow
                  key={coil.address}
                  info={coil}
                  value={snapshot?.[tab]?.[coil.address]}
                  deviceId={deviceId}
                  type={tab}
                />
              ))}
              {registers[tab].length === 0 && (
                <tr>
                  <td colSpan={7} className="field-label px-3 py-6 text-center">
                    No {tab} defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
