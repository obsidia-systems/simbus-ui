import { useState } from 'react'

import type { DeviceRecord } from '@/app/api'
import type { RegisterInfo, SimbusConfig } from '@/types/simbus'

export function ConnectPanel({ device, config }: { device: DeviceRecord; config?: SimbusConfig }) {
  const [copied, setCopied] = useState(false)
  const lease = device.leases.find((l) => l.protocol === 'modbus-tcp' && l.published)
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const port = lease?.hostPort
  const unitId = config?.unit_id ?? 1
  const endianness = config?.endianness ?? 'big'
  const holding = config?.registers.holding ?? []

  const snippet = ignitionSnippet({
    host,
    port,
    unitId,
    endianness,
    holding,
    deviceName: device.name,
  })

  async function copy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="field-label">Connect</p>
          <h2 className="text-sm font-semibold">Ignition / BMS</h2>
        </div>
        <button className="btn btn-ghost text-xs" onClick={() => void copy()} disabled={!port}>
          {copied ? 'Copied' : 'Copy connection'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta label="Host" value={host} />
        <Meta label="Port" value={port ? String(port) : 'unpublished'} />
        <Meta label="Unit ID" value={String(unitId)} />
        <Meta label="Endianness" value={endianness} />
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-[var(--bg-overlay)] p-3 font-mono text-[0.7rem] text-[var(--text-mono)]">
        {snippet}
      </pre>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <p className="mono-value">{value}</p>
    </div>
  )
}

function ignitionSnippet({
  host,
  port,
  unitId,
  endianness,
  holding,
  deviceName,
}: {
  host: string
  port?: number
  unitId: number
  endianness: string
  holding: RegisterInfo[]
  deviceName: string
}): string {
  const lines = [
    `# ${deviceName} — Modbus TCP (simbus)`,
    `# Ignition addressing is 1-based: HR{n+1} where n is the simbus holding address.`,
    `host: ${host}`,
    `port: ${port ?? '(publish a Modbus lease first)'}`,
    `unitId: ${unitId}`,
    `endianness: ${endianness}`,
    '',
  ]
  for (const r of holding) {
    const scale = r.scale && r.scale !== 1 ? ` / ${r.scale}` : ''
    lines.push(`# ${r.name}: HR${r.address + 1} (${r.data_type})${scale}  ${r.unit}`)
  }
  return lines.join('\n')
}
