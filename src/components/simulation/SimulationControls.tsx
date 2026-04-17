import { actions } from 'astro:actions'

import { useState } from 'react'

interface Props {
  deviceId: string
  tickInterval: number
}

export function SimulationControls({ deviceId, tickInterval }: Props) {
  const [tick, setTick] = useState(String(tickInterval))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [saved, setSaved] = useState(false)
  const tickIntervalId = 'simulation-tick-interval'

  async function handleApply() {
    const val = parseFloat(tick)
    if (isNaN(val) || val < 0.1 || val > 60) return
    setSaving(true)
    await actions.simulation.patch({ deviceId, tick_interval: val })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleReset() {
    setResetting(true)
    await actions.simulation.reset({ deviceId })
    setResetting(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <label className="field-label shrink-0" htmlFor={tickIntervalId}>
            Tick interval
          </label>
          <input
            id={tickIntervalId}
            type="number"
            min="0.1"
            max="60"
            step="0.1"
            value={tick}
            onChange={(e) => {
              setTick(e.target.value)
              setSaved(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            className="dc-input w-20 px-2 py-1.5 text-xs"
          />
          <span className="field-label">seconds</span>
          <button
            onClick={handleApply}
            disabled={saving}
            className="btn btn-ghost px-2 py-1 text-xs"
            style={saved ? { color: 'var(--accent-green)' } : {}}
          >
            {saving ? '…' : saved ? 'Saved' : 'Apply'}
          </button>
        </div>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="btn btn-ghost px-3 py-1.5 text-xs"
        >
          {resetting ? 'Resetting…' : 'Reset to Defaults'}
        </button>
      </div>

      <p className="text-[0.65rem]" style={{ color: 'var(--text-muted)' }}>
        How often the simulation advances one tick. Lower = more frequent updates.
      </p>
    </div>
  )
}
