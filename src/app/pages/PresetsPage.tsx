import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { apiGet, apiSend, type CatalogPreset, type DeviceRecord, type TemplateDraft } from '@/app/api'
import { YamlEditor } from '@/app/components/YamlEditor'
import { useWizard } from '@/app/store'
import { nextUniqueName, slugify } from '@/lib/names'

export function PresetsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const wizard = useWizard()
  const [editing, setEditing] = useState<TemplateDraft | null>(null)

  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogPreset[]>('/api/catalog'),
  })
  const drafts = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<TemplateDraft[]>('/api/templates'),
  })
  const existing = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet<DeviceRecord[]>('/api/devices'),
  })
  const sync = useMutation({
    mutationFn: () => apiSend<CatalogPreset[]>('/api/catalog', 'POST'),
    onSuccess: (data) => queryClient.setQueryData(['catalog'], data),
  })
  const saveDraft = useMutation({
    mutationFn: () =>
      editing
        ? apiSend(`/api/templates/${editing.id}`, 'PATCH', {
            name: editing.name,
            yamlConfig: editing.yamlConfig,
          })
        : Promise.resolve(null),
    onSuccess: () => {
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  function uniqueLabel(label: string): string {
    const taken = (existing.data ?? []).map((d) => slugify(d.name))
    return nextUniqueName(slugify(label) || 'device', taken)
  }

  function deploy(preset: CatalogPreset) {
    wizard.reset()
    wizard.set({ presetId: preset.id, name: uniqueLabel(preset.name), step: 2 })
    void fetch(`/api/catalog/${preset.id}`)
      .then((r) => r.json())
      .then((body: { yaml?: string }) => wizard.set({ yaml: body.yaml ?? '' }))
    void navigate({ to: '/devices/new' })
  }

  async function copyToDraft(preset: CatalogPreset) {
    const res = await fetch(`/api/catalog/${preset.id}`)
    const body = (await res.json()) as { yaml?: string }
    await apiSend('/api/templates', 'POST', {
      name: `${preset.name} draft`,
      sourcePresetId: preset.id,
      yamlConfig: body.yaml ?? '',
    })
    await queryClient.invalidateQueries({ queryKey: ['templates'] })
  }

  const builtin = (catalog.data ?? []).filter((p) => p.source === 'builtin')
  const community = (catalog.data ?? []).filter((p) => p.source === 'community')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="field-label mb-1">catalog</p>
          <h1 className="text-xl font-semibold">Presets</h1>
        </div>
        <button className="btn btn-ghost text-xs" onClick={() => sync.mutate()}>
          {sync.isPending ? 'Syncing…' : 'Sync from image'}
        </button>
      </div>

      {sync.error && (
        <p className="text-sm text-[var(--accent-red)]">{(sync.error as Error).message}</p>
      )}

      <Section title="Builtin">
        {builtin.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            onDeploy={() => deploy(p)}
            onDraft={() => void copyToDraft(p)}
          />
        ))}
      </Section>
      <Section title="Community">
        {community.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No community presets in this image.</p>
        ) : (
          community.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              onDeploy={() => deploy(p)}
              onDraft={() => void copyToDraft(p)}
            />
          ))
        )}
      </Section>
      <Section title="Drafts">
        {(drafts.data ?? []).map((d) => (
          <article key={d.id} className="panel p-4">
            <p className="text-sm font-semibold">{d.name}</p>
            <div className="mt-2 flex gap-2">
              <button className="btn btn-primary text-xs" onClick={() => setEditing(d)}>
                Edit
              </button>
              <button
                className="btn btn-ghost text-xs"
                onClick={() => {
                  wizard.reset()
                  wizard.set({
                    presetId: d.sourcePresetId,
                    yaml: d.yamlConfig,
                    name: uniqueLabel(d.name),
                    step: 2,
                  })
                  void navigate({ to: '/devices/new' })
                }}
              >
                Deploy
              </button>
            </div>
          </article>
        ))}
      </Section>

      {editing && (
        <div className="panel p-4">
          <p className="field-label mb-2">Edit draft</p>
          <input
            className="dc-input mb-3"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <YamlEditor
            value={editing.yamlConfig}
            onChange={(yamlConfig) => setEditing({ ...editing, yamlConfig })}
          />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary text-xs" onClick={() => saveDraft.mutate()}>
              Save
            </button>
            <button className="btn btn-ghost text-xs" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Named labs are P1. This catalog is pinned to <span className="font-mono">SIMBUS_IMAGE</span>
        .
      </p>
      <Link to="/devices/new" className="btn btn-primary self-start text-xs">
        New device
      </Link>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="field-label mb-2">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function PresetCard({
  preset,
  onDeploy,
  onDraft,
}: {
  preset: CatalogPreset
  onDeploy: () => void
  onDraft: () => void
}) {
  return (
    <article className="panel flex flex-col gap-2 p-4">
      <p className="text-sm font-semibold">{preset.name}</p>
      <p className="line-clamp-3 flex-1 text-xs text-[var(--text-secondary)]">
        {preset.description}
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs" onClick={onDeploy}>
          Deploy
        </button>
        <button className="btn btn-ghost text-xs" onClick={onDraft}>
          Copy to draft
        </button>
      </div>
    </article>
  )
}
