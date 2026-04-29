import { actions } from 'astro:actions'

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { Template } from '@/db/schema'
import { DEVICE_TYPES } from '@/lib/device-types'

const queryClient = new QueryClient()

// ─── New template form ────────────────────────────────────────────────────────

function NewTemplateForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState(DEVICE_TYPES[0]!.key)
  const [tickInterval, setTickInterval] = useState('1.0')
  const [yamlConfig, setYamlConfig] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameId = 'template-name'
  const descriptionId = 'template-description'
  const deviceTypeId = 'template-device-type'
  const tickIntervalId = 'template-tick-interval'
  const yamlConfigId = 'template-yaml-config'

  const isCustom = type === 'custom'

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (isCustom && !yamlConfig.trim()) {
      setError('YAML config is required for custom type')
      return
    }
    setBusy(true)
    setError(null)
    const result = await actions.templates.create({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      tickInterval: parseFloat(tickInterval) || 1.0,
      yamlConfig: yamlConfig.trim() || undefined,
    })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'Failed')
      return
    }
    await qc.invalidateQueries({ queryKey: ['templates'] })
    onDone()
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-lg p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-cyan)44' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        New Template
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            className="dc-input px-3 py-1.5 text-sm"
            placeholder="e.g. Standard T&H Sensor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor={descriptionId}>
            Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input
            id={descriptionId}
            className="dc-input px-3 py-1.5 text-sm"
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor={deviceTypeId}>
            Device type
          </label>
          <select
            id={deviceTypeId}
            className="dc-input px-3 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {DEVICE_TYPES.map((dt) => (
              <option key={dt.key} value={dt.key}>
                {dt.label}
              </option>
            ))}
            <option value="custom">Custom YAML</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor={tickIntervalId}>
            Tick interval (s)
          </label>
          <input
            id={tickIntervalId}
            type="number"
            min="0.1"
            max="60"
            step="0.1"
            className="dc-input px-3 py-1.5 text-sm"
            value={tickInterval}
            onChange={(e) => setTickInterval(e.target.value)}
          />
        </div>
      </div>

      {isCustom && (
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor={yamlConfigId}>
            YAML configuration
          </label>
          <textarea
            id={yamlConfigId}
            className="dc-input px-3 py-2 font-mono text-xs leading-relaxed"
            rows={12}
            placeholder={
              'name: my-device\ntype: custom\nregisters:\n  holding:\n    - address: 0\n      name: temperature\n      ...'
            }
            value={yamlConfig}
            onChange={(e) => setYamlConfig(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={busy}
          className="btn btn-primary px-4 py-1.5 text-sm"
        >
          {busy ? 'Saving…' : 'Save Template'}
        </button>
        <button onClick={onDone} className="btn btn-ghost text-sm">
          Cancel
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

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: Template }) {
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const typeDef = DEVICE_TYPES.find((d) => d.key === template.type)
  const isCustom = template.type === 'custom'

  async function handleDelete() {
    await actions.templates.delete({ id: template.id })
    await qc.invalidateQueries({ queryKey: ['templates'] })
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4 transition-all"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {template.name}
          </h3>
          {template.description && (
            <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
              {template.description}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold"
          style={{
            background: isCustom ? 'var(--accent-purple-dim)' : 'var(--accent-cyan-dim)',
            color: isCustom ? 'var(--accent-purple)' : 'var(--accent-cyan)',
            border: `1px solid ${isCustom ? 'var(--accent-purple)' : 'var(--accent-cyan)'}33`,
          }}
        >
          {isCustom ? 'custom' : (typeDef?.label ?? template.type)}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3">
        <MetaChip label="tick" value={`${template.tickInterval}s`} />
        {template.seed != null && <MetaChip label="seed" value={String(template.seed)} />}
        {isCustom && template.yamlConfig && (
          <MetaChip label="yaml" value={`${template.yamlConfig.split('\n').length} lines`} />
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 border-t pt-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <a
          href={`/devices/new?template=${template.id}`}
          className="btn btn-success px-3 py-1 text-xs"
        >
          Deploy
        </a>
        <div className="ml-auto">
          {confirmDelete ? (
            <>
              <span className="mr-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Delete?
              </span>
              <button className="btn btn-danger mr-1 text-xs" onClick={handleDelete}>
                Confirm
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost text-xs"
              style={{ color: 'var(--accent-red)' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="field-label">{label}</span>
      <span className="mono-value text-xs">{value}</span>
    </div>
  )
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function Grid() {
  const [showForm, setShowForm] = useState(false)

  const { data: templateList = [], isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="btn btn-primary text-sm">
          {showForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {showForm && <NewTemplateForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex items-center gap-2 py-8">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: 'var(--accent-cyan)', animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      ) : templateList.length === 0 && !showForm ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg py-20"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            No templates yet
          </p>
          <p className="max-w-sm text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Create a template to quickly deploy devices with a preset configuration, or save one
            from an existing device.
          </p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary mt-1 text-sm">
            Create first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templateList.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TemplatesGrid() {
  return (
    <QueryClientProvider client={queryClient}>
      <Grid />
    </QueryClientProvider>
  )
}
