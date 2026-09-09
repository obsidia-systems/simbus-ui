import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { apiGet, apiSend, type CatalogPreset, type DeviceRecord } from '@/app/api'
import { YamlEditor } from '@/app/components/YamlEditor'
import { useWizard } from '@/app/store'
import { nextUniqueName, slugify } from '@/lib/names'

export function WizardPage() {
  const wizard = useWizard()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogPreset[]>('/api/catalog'),
  })
  const existing = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet<DeviceRecord[]>('/api/devices'),
  })

  const create = useMutation({
    mutationFn: () =>
      apiSend<DeviceRecord>('/api/devices', 'POST', {
        name: wizard.name.trim(),
        presetId: wizard.presetId,
        yaml: wizard.yaml.trim() || undefined,
        tickInterval: wizard.tickInterval,
        seed: wizard.seed.trim() ? Number(wizard.seed) : undefined,
        hostModbusPort: wizard.hostModbusPort.trim() ? Number(wizard.hostModbusPort) : undefined,
        publishModbus: true,
      }),
    onSuccess: async (device) => {
      queryClient.setQueryData<DeviceRecord[]>(['devices'], (old) => {
        if (!old) return [device]
        if (old.some((row) => row.id === device.id)) return old
        return [device, ...old]
      })
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      wizard.reset()
      void navigate({ to: '/' })
    },
    onError: (err: Error) => setError(err.message),
  })

  async function pickPreset(id: string) {
    wizard.set({ presetId: id, step: 2 })
    const preset = catalog.data?.find((p) => p.id === id)
    const taken = (existing.data ?? []).map((d) => slugify(d.name))
    const label = slugify(preset?.name ?? 'device')
    wizard.set({ name: nextUniqueName(label, taken) })
    try {
      const res = await fetch(`/api/catalog/${id}`)
      if (!res.ok) return
      const body = (await res.json()) as { yaml?: string; name?: string }
      wizard.set({
        yaml: body.yaml ?? '',
        name: nextUniqueName(slugify(body.name ?? preset?.name ?? 'device'), taken),
      })
    } catch {
      /* catalog fetch optional at this step */
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="field-label mb-1">new device</p>
        <h1 className="text-xl font-semibold">From preset</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Control HTTP stays on simbus-net. Only Modbus (or other field leases) is published to the
          host.
        </p>
      </div>

      <ol className="flex gap-2 text-xs">
        {(['Preset', 'Overlay', 'YAML'] as const).map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${wizard.step === i + 1 ? 'bg-[var(--accent-cyan-dim)] text-[var(--accent-cyan)]' : 'text-[var(--text-muted)]'}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {wizard.step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(catalog.data ?? []).map((preset) => (
            <button
              key={preset.id}
              className="panel p-4 text-left hover:border-[var(--border-strong)]"
              onClick={() => pickPreset(preset.id)}
            >
              <span className="field-label">{preset.source}</span>
              <p className="text-sm font-semibold">{preset.name}</p>
              <p className="mt-1 line-clamp-3 text-xs text-[var(--text-secondary)]">
                {preset.description}
              </p>
            </button>
          ))}
          {catalog.isLoading && (
            <p className="text-sm text-[var(--text-secondary)]">Syncing catalog…</p>
          )}
          {!catalog.isLoading && (catalog.data?.length ?? 0) === 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              No presets. Pull the simbus image and click Sync on the Presets page.
            </p>
          )}
        </div>
      )}

      {wizard.step === 2 && (
        <form
          className="panel flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            wizard.set({ step: 3 })
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="field-label">Name</span>
            <input
              className="dc-input"
              value={wizard.name}
              onChange={(e) => wizard.set({ name: e.target.value })}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Tick interval (s)</span>
            <input
              className="dc-input"
              type="number"
              min={0.1}
              step={0.1}
              value={wizard.tickInterval}
              onChange={(e) => wizard.set({ tickInterval: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Seed (optional)</span>
            <input
              className="dc-input"
              value={wizard.seed}
              onChange={(e) => wizard.set({ seed: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Host Modbus port (blank = allocate 5020+)</span>
            <input
              className="dc-input"
              value={wizard.hostModbusPort}
              onChange={(e) => wizard.set({ hostModbusPort: e.target.value })}
            />
          </label>
          <p className="text-xs text-[var(--text-muted)]">
            Advanced: in host-dev the UI binds loopback :8000 so it can proxy. That port is never a
            field lease and is not shown in Connect.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => wizard.set({ step: 1 })}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </div>
        </form>
      )}

      {wizard.step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Optional copy-on-write edit. Leave as-is to deploy the preset YAML. Validated with{' '}
            <span className="font-mono">simbus check</span>.
          </p>
          <YamlEditor value={wizard.yaml} onChange={(yaml) => wizard.set({ yaml })} />
          {error && <p className="text-sm text-[var(--accent-red)]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => wizard.set({ step: 2 })}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={create.isPending || !wizard.name.trim()}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Creating…' : 'Create device'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
