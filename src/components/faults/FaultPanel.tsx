import { actions } from 'astro:actions'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { SimbusConfig } from '@/types/simbus'

interface Props {
  deviceId: string
}

type FaultType = 'spike' | 'freeze' | 'dropout' | 'alarm' | 'noise_amplify'

const FAULT_TYPES: {
  value: FaultType
  label: string
  needsRegister: boolean
  needsValue: boolean
  valueLabel: string
  hint: string
}[] = [
  {
    value: 'spike',
    label: 'Spike',
    needsRegister: true,
    needsValue: true,
    valueLabel: 'Spike value',
    hint: 'One-time spike to a raw value',
  },
  {
    value: 'freeze',
    label: 'Freeze',
    needsRegister: true,
    needsValue: false,
    valueLabel: '',
    hint: 'Lock register at its current value',
  },
  {
    value: 'dropout',
    label: 'Dropout',
    needsRegister: false,
    needsValue: false,
    valueLabel: '',
    hint: 'Device stops responding entirely',
  },
  {
    value: 'alarm',
    label: 'Alarm',
    needsRegister: true,
    needsValue: false,
    valueLabel: '',
    hint: 'Trigger alarm state on register',
  },
  {
    value: 'noise_amplify',
    label: 'Noise Amplify',
    needsRegister: true,
    needsValue: true,
    valueLabel: 'Factor',
    hint: 'Amplify signal noise by a factor',
  },
]

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function FaultPanel({ deviceId }: Props) {
  const queryClient = useQueryClient()

  const [faultType, setFaultType] = useState<FaultType>('spike')
  const [registerName, setRegisterName] = useState('')
  const [value, setValue] = useState('')
  const [duration, setDuration] = useState('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: config } = useQuery<SimbusConfig>({
    queryKey: ['config', deviceId],
    queryFn: () => fetchJson<SimbusConfig>(`/api/devices/${deviceId}/config`),
    staleTime: Infinity,
    retry: false,
  })

  const selected = FAULT_TYPES.find((f) => f.value === faultType)!
  const faultTypeId = 'fault-type'
  const registerNameId = 'fault-register-name'
  const faultValueId = 'fault-value'
  const durationId = 'fault-duration'

  const registerOptions = [
    ...(config?.registers.holding ?? []).map((r) => ({ name: r.name, group: 'Holding' })),
    ...(config?.registers.input ?? []).map((r) => ({ name: r.name, group: 'Input' })),
  ]

  async function handleInject() {
    setError(null)
    if (selected.needsRegister && !registerName) {
      setError('Select a target register')
      return
    }
    const numValue = value !== '' ? parseFloat(value) : undefined
    if (selected.needsValue && numValue === undefined) {
      setError(`Enter a ${selected.valueLabel.toLowerCase()}`)
      return
    }
    const dur = parseInt(duration, 10)
    if (isNaN(dur) || dur < 1) {
      setError('Duration must be ≥ 1s')
      return
    }

    setBusy(true)
    const result = await actions.faults.inject({
      deviceId,
      fault_type: faultType,
      register_name: selected.needsRegister ? registerName : undefined,
      value: numValue,
      duration_s: dur,
    })
    setBusy(false)

    if (result.error) {
      setError(result.error.message ?? 'Injection failed')
      return
    }

    setValue('')
    await queryClient.invalidateQueries({ queryKey: ['faults', deviceId] })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {/* Fault type */}
        <div className="flex min-w-36 flex-col gap-1.5">
          <label className="field-label" htmlFor={faultTypeId}>
            Fault type
          </label>
          <select
            id={faultTypeId}
            value={faultType}
            onChange={(e) => {
              setFaultType(e.target.value as FaultType)
              setError(null)
            }}
            className="dc-input px-2 py-1.5 text-xs"
          >
            {FAULT_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="text-[0.6rem]" style={{ color: 'var(--text-muted)' }}>
            {selected.hint}
          </span>
        </div>

        {/* Register */}
        {selected.needsRegister && (
          <div className="flex min-w-44 flex-col gap-1.5">
            <label className="field-label" htmlFor={registerNameId}>
              Target register
            </label>
            <select
              id={registerNameId}
              value={registerName}
              onChange={(e) => {
                setRegisterName(e.target.value)
                setError(null)
              }}
              className="dc-input px-2 py-1.5 text-xs"
            >
              <option value="">— select —</option>
              {registerOptions.map((r) => (
                <option key={`${r.group}-${r.name}`} value={r.name}>
                  [{r.group}] {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Value */}
        {selected.needsValue && (
          <div className="flex w-28 flex-col gap-1.5">
            <label className="field-label" htmlFor={faultValueId}>
              {selected.valueLabel}
            </label>
            <input
              id={faultValueId}
              type="number"
              step="any"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              className="dc-input px-2 py-1.5 text-xs"
              placeholder={faultType === 'noise_amplify' ? '2.0' : '0'}
            />
          </div>
        )}

        {/* Duration */}
        <div className="flex w-28 flex-col gap-1.5">
          <label className="field-label" htmlFor={durationId}>
            Duration (s)
          </label>
          <input
            id={durationId}
            type="number"
            min="1"
            max="3600"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="dc-input px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleInject}
          disabled={busy}
          className="btn px-3 py-1.5 text-xs"
          style={{
            background: 'var(--accent-amber-dim)',
            border: '1px solid var(--accent-amber)55',
            color: 'var(--accent-amber)',
          }}
        >
          {busy ? 'Injecting…' : 'Inject Fault'}
        </button>
        {error && (
          <span className="text-xs" style={{ color: 'var(--accent-red)' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
