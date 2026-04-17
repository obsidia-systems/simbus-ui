import { actions } from 'astro:actions'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { z } from 'zod'

const queryClient = new QueryClient()

import { zodResolver } from '@hookform/resolvers/zod'

import type { Template } from '@/db/schema'
import { DEVICE_TYPES, getDeviceType } from '@/lib/device-types'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Required').max(64),
  type: z.string().min(1, 'Select a type'),
  internalModbusPort: z.number().int().min(1).max(65535),
  internalApiPort: z.number().int().min(1024).max(65535),
  tickInterval: z.number().min(0.1).max(60),
  exposeModbus: z.boolean(),
  exposeApi: z.boolean(),
  hostModbusPort: z.number().int().min(1).max(65535).optional(),
  hostApiPort: z.number().int().min(1024).max(65535).optional(),
  seed: z.number().int().optional(),
  yamlConfig: z.string().optional(),
  saveAsTemplate: z.boolean(),
  templateName: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Type', 'Config', 'Ports', 'Review']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex size-6 items-center justify-center rounded-full text-[0.625rem] font-semibold transition-all"
              style={{
                background:
                  i < current
                    ? 'var(--accent-green)'
                    : i === current
                      ? 'var(--accent-cyan)'
                      : 'var(--bg-overlay)',
                color: i <= current ? '#07090e' : 'var(--text-muted)',
                border:
                  i === current
                    ? '1px solid var(--accent-cyan)'
                    : i < current
                      ? '1px solid var(--accent-green)'
                      : '1px solid var(--border)',
              }}
            >
              {i < current ? (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="size-3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2 5 2.5 2.5L8 3" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className="text-[0.6rem] font-medium"
              style={{
                color: i === current ? 'var(--accent-cyan)' : 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-2 mb-4 h-px w-8 transition-colors"
              style={{ background: i < current ? 'var(--accent-green)' : 'var(--border)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1 — Type ────────────────────────────────────────────────────────────

function StepType({
  value,
  templates,
  onChange,
}: {
  value: string
  templates: Template[]
  onChange: (type: string, defaultPort: number, fromTemplate?: Template) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Built-in types */}
      <div className="flex flex-col gap-2">
        <p className="field-label">Built-in types</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEVICE_TYPES.map((dt) => (
            <button
              key={dt.key}
              type="button"
              onClick={() => onChange(dt.key, dt.defaultModbusPort)}
              className="flex flex-col gap-1 rounded-lg p-3 text-left transition-all"
              style={{
                background: value === dt.key ? 'var(--accent-cyan-dim)' : 'var(--bg-overlay)',
                border:
                  value === dt.key ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
              }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: value === dt.key ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
              >
                {dt.label}
              </span>
              <span
                className="text-[0.7rem] leading-snug"
                style={{ color: 'var(--text-secondary)' }}
              >
                {dt.description}
              </span>
              <span
                className="mono-value mt-1 text-[0.7rem]"
                style={{ color: 'var(--text-muted)' }}
              >
                Modbus :{dt.defaultModbusPort}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Saved templates */}
      {templates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="field-label">From template</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((t) => {
              const isCustom = t.type === 'custom'
              const typeLabel = isCustom
                ? 'Custom YAML'
                : (DEVICE_TYPES.find((d) => d.key === t.type)?.label ?? t.type)
              const selKey = `template:${t.id}`
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange(t.type, t.internalModbusPort, t)}
                  className="flex flex-col gap-1 rounded-lg p-3 text-left transition-all"
                  style={{
                    background: value === selKey ? 'var(--accent-purple-dim)' : 'var(--bg-overlay)',
                    border:
                      value === selKey
                        ? '1px solid var(--accent-purple)'
                        : '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: value === selKey ? 'var(--accent-purple)' : 'var(--text-primary)',
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[0.6rem]"
                      style={{
                        background: 'var(--bg-base)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {typeLabel}
                    </span>
                  </div>
                  {t.description && (
                    <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>
                      {t.description}
                    </span>
                  )}
                  <span className="mono-value text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                    tick {t.tickInterval}s{t.seed != null ? ` · seed ${t.seed}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom YAML */}
      <div className="flex flex-col gap-2">
        <p className="field-label">Custom</p>
        <button
          type="button"
          onClick={() => onChange('custom', 502)}
          className="flex flex-col gap-1 rounded-lg p-3 text-left transition-all"
          style={{
            background: value === 'custom' ? 'var(--accent-purple-dim)' : 'var(--bg-overlay)',
            border:
              value === 'custom' ? '1px solid var(--accent-purple)' : '1px solid var(--border)',
          }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: value === 'custom' ? 'var(--accent-purple)' : 'var(--text-primary)' }}
          >
            Custom YAML
          </span>
          <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>
            Define registers, behaviors, and defaults with a YAML config file
          </span>
        </button>
      </div>
    </div>
  )
}

// ─── Step 2 — Config ──────────────────────────────────────────────────────────

function StepConfig({
  register,
  errors,
  isCustom,
}: {
  register: any
  errors: any
  isCustom: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="field-label" htmlFor="name">
          Device name
        </label>
        <input
          id="name"
          className="dc-input"
          placeholder="e.g. hot-aisle-01"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-[0.7rem]" style={{ color: 'var(--accent-red)' }}>
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="internalModbusPort">
            Modbus port
          </label>
          <input
            id="internalModbusPort"
            type="number"
            className="dc-input"
            {...register('internalModbusPort', { valueAsNumber: true })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="internalApiPort">
            API port
          </label>
          <input
            id="internalApiPort"
            type="number"
            className="dc-input"
            {...register('internalApiPort', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="field-label" htmlFor="tickInterval">
          Tick interval (seconds)
        </label>
        <input
          id="tickInterval"
          type="number"
          step="0.1"
          className="dc-input"
          {...register('tickInterval', { valueAsNumber: true })}
        />
        <p className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
          How often the simulation updates register values (0.1 – 60s)
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="field-label" htmlFor="seed">
          RNG seed <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <input
          id="seed"
          type="number"
          className="dc-input"
          placeholder="Leave blank for random"
          {...register('seed', {
            setValueAs: (v: string) => (v === '' || v == null ? undefined : parseInt(v, 10)),
          })}
        />
      </div>

      {/* Custom YAML textarea */}
      {isCustom && (
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="yamlConfig">
            YAML configuration
          </label>
          <textarea
            id="yamlConfig"
            className="dc-input px-3 py-2 font-mono text-xs leading-relaxed"
            rows={14}
            placeholder={
              'name: my-device\ntype: custom\nregisters:\n  holding:\n    - address: 0\n      name: temperature\n      scale: 10\n      unit: "°C"\n      default: 220'
            }
            {...register('yamlConfig')}
            style={{ resize: 'vertical' }}
          />
          <p className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
            Passed to the simbus container via{' '}
            <span className="mono-value">SIMBUS_YAML_CONFIG</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 3 — Ports ───────────────────────────────────────────────────────────

function StepPorts({ watch, register }: { watch: any; register: any }) {
  const exposeModbus = watch('exposeModbus')
  const exposeApi = watch('exposeApi')

  return (
    <div className="flex flex-col gap-4">
      {!exposeApi && (
        <div
          className="flex gap-2.5 rounded-lg p-3"
          style={{
            background: 'var(--accent-amber-dim)',
            border: '1px solid var(--accent-amber)55',
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="mt-0.5 size-3.5 shrink-0"
            style={{ color: 'var(--accent-amber)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              stroke="currentColor"
              d="M8 2 1.5 13.5h13L8 2ZM8 6v4M8 11.5v.5"
            />
          </svg>
          <p className="text-xs leading-snug" style={{ color: 'var(--accent-amber)' }}>
            <strong>Running simbus-ui on the host?</strong> You must expose the REST API port so the
            UI can reach this container.
          </p>
        </div>
      )}

      <div
        className="rounded-lg p-3 text-sm"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        Port mapping exposes container ports to your host machine.
      </div>

      {[
        {
          field: 'exposeModbus',
          portField: 'hostModbusPort',
          expose: exposeModbus,
          label: 'Expose Modbus TCP port',
          desc: 'Required for external Modbus clients (SCADA, HMI, test tools)',
        },
        {
          field: 'exposeApi',
          portField: 'hostApiPort',
          expose: exposeApi,
          label: 'Expose REST API port',
          desc: 'Required when simbus-ui runs on the host (dev mode)',
        },
      ].map(({ field, portField, expose, label, desc }) => (
        <div
          key={field}
          className="flex flex-col gap-3 rounded-lg p-3"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
        >
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" {...register(field)} className="accent-(--accent-cyan)" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {label}
              </p>
              <p className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>
                {desc}
              </p>
            </div>
          </label>
          {expose && (
            <div className="flex flex-col gap-1.5 pl-5">
              <label className="field-label" htmlFor={`host-port-${field}`}>
                Host port
              </label>
              <input
                id={`host-port-${field}`}
                type="number"
                className="dc-input"
                {...register(portField, { valueAsNumber: true })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 4 — Review ─────────────────────────────────────────────────────────

function StepReview({
  values,
  register,
  watch,
}: {
  values: FormValues
  register: any
  watch: any
}) {
  const typeDef = getDeviceType(values.type)
  const saveAsTemplate = watch('saveAsTemplate')
  const isCustom = values.type === 'custom'

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: values.name },
    { label: 'Type', value: isCustom ? 'Custom YAML' : (typeDef?.label ?? values.type) },
    { label: 'Modbus port', value: String(values.internalModbusPort) },
    { label: 'API port', value: String(values.internalApiPort) },
    { label: 'Tick interval', value: `${values.tickInterval}s` },
    { label: 'Seed', value: values.seed ? String(values.seed) : 'random' },
    {
      label: 'Host Modbus port',
      value:
        values.exposeModbus && values.hostModbusPort
          ? String(values.hostModbusPort)
          : 'not exposed',
    },
    {
      label: 'Host API port',
      value: values.exposeApi && values.hostApiPort ? String(values.hostApiPort) : 'not exposed',
    },
    ...(isCustom && values.yamlConfig
      ? [{ label: 'YAML', value: `${values.yamlConfig.split('\n').length} lines` }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className="flex items-center justify-between px-3 py-2.5"
            style={{
              borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            }}
          >
            <span className="field-label">{label}</span>
            <span className="mono-value">{value}</span>
          </div>
        ))}
      </div>

      {/* Save as template */}
      <div
        className="flex flex-col gap-3 rounded-lg p-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            {...register('saveAsTemplate')}
            className="accent-(--accent-cyan)"
          />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            Save configuration as a template
          </span>
        </label>
        {saveAsTemplate && (
          <div className="flex flex-col gap-1.5 pl-5">
            <label className="field-label" htmlFor="template-name">
              Template name
            </label>
            <input
              id="template-name"
              className="dc-input px-3 py-1.5 text-sm"
              placeholder={values.name || 'Template name'}
              {...register('templateName')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface WizardProps {
  preloadTemplateId?: string | null
}

function WizardInner({ preloadTemplateId }: WizardProps) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  // Track selected template key (for StepType highlight)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')

  const { data: templateList = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) return []
      return res.json()
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: '',
      internalModbusPort: 502,
      internalApiPort: 8000,
      tickInterval: 1.0,
      exposeModbus: false,
      exposeApi: false,
      seed: undefined,
      yamlConfig: '',
      saveAsTemplate: false,
      templateName: '',
    },
  })

  const selectedType = watch('type')
  const isCustom = selectedType === 'custom'

  // Pre-fill from URL ?template= param once templates are loaded
  useEffect(() => {
    if (!preloadTemplateId || templateList.length === 0) return
    const t = templateList.find((t) => t.id === preloadTemplateId)
    if (!t) return
    handleTypeChange(t.type, t.internalModbusPort, t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadTemplateId, templateList])

  function handleTypeChange(type: string, defaultPort: number, fromTemplate?: Template) {
    setValue('type', type)
    setValue('internalModbusPort', fromTemplate?.internalModbusPort ?? defaultPort)
    setValue('hostModbusPort', fromTemplate?.internalModbusPort ?? defaultPort)
    setValue('internalApiPort', fromTemplate?.internalApiPort ?? 8000)
    setValue('tickInterval', fromTemplate?.tickInterval ?? 1.0)
    if (fromTemplate?.seed != null) setValue('seed', fromTemplate.seed)
    if (fromTemplate?.yamlConfig) setValue('yamlConfig', fromTemplate.yamlConfig)
    setSelectedTemplateKey(fromTemplate ? `template:${fromTemplate.id}` : type)
  }

  async function nextStep() {
    const fieldsPerStep: (keyof FormValues)[][] = [
      ['type'],
      ['name', 'internalModbusPort', 'internalApiPort', 'tickInterval'],
      [],
      [],
    ]
    const valid = await trigger(fieldsPerStep[step])
    if (valid) setStep((s) => s + 1)
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitting(true)
    setServerError(null)
    setValidationError(null)

    const { error } = await actions.devices.create({
      name: values.name,
      type: values.type,
      internalModbusPort: values.internalModbusPort,
      internalApiPort: values.internalApiPort,
      hostModbusPort: values.exposeModbus && values.hostModbusPort ? values.hostModbusPort : null,
      hostApiPort: values.exposeApi && values.hostApiPort ? values.hostApiPort : null,
      tickInterval: values.tickInterval,
      seed: values.seed ? Number(values.seed) : null,
      yamlConfig: values.yamlConfig || null,
    })

    if (error) {
      setServerError(error.message ?? 'Failed to create device')
      setSubmitting(false)
      return
    }

    // Optionally save as template
    if (values.saveAsTemplate) {
      await actions.templates.create({
        name: values.templateName || values.name,
        type: values.type,
        internalModbusPort: values.internalModbusPort,
        internalApiPort: values.internalApiPort,
        tickInterval: values.tickInterval,
        seed: values.seed ?? null,
        yamlConfig: values.yamlConfig || null,
      })
    }

    window.location.href = '/'
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <StepIndicator current={step} />

      <div className="panel animate-fade-in p-5" key={step}>
        {step === 0 && (
          <StepType
            value={selectedTemplateKey || selectedType}
            templates={templateList}
            onChange={handleTypeChange}
          />
        )}
        {step === 1 && <StepConfig register={register} errors={errors} isCustom={isCustom} />}
        {step === 2 && <StepPorts watch={watch} register={register} />}
        {step === 3 && <StepReview values={getValues()} register={register} watch={watch} />}
      </div>

      {(serverError || validationError) && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: 'var(--accent-red-dim)',
            border: '1px solid var(--accent-red)',
            color: 'var(--accent-red)',
          }}
        >
          {serverError ?? validationError}
        </p>
      )}

      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
        ) : (
          <a href="/" className="btn btn-ghost">
            Cancel
          </a>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={nextStep}
            disabled={step === 0 && !selectedType}
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit(onSubmit, (fieldErrors) => {
              const first = Object.values(fieldErrors)[0]
              const msg = first && 'message' in first ? (first.message as string) : null
              setValidationError(msg ?? 'Check the form fields and try again')
            })}
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create Device'}
          </button>
        )}
      </div>
    </div>
  )
}

export function DeviceWizard({ preloadTemplateId }: WizardProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WizardInner preloadTemplateId={preloadTemplateId} />
    </QueryClientProvider>
  )
}
