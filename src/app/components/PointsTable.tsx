import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flexRender } from '@tanstack/react-table'
import { getCoreRowModel, useLegacyTable } from '@tanstack/react-table/legacy'
import { useMemo, useState } from 'react'

import { apiSend } from '@/app/api'
import type { PointLive, RegisterInfo, SimbusConfig } from '@/types/simbus'

function holdingForPoint(
  config: SimbusConfig | undefined,
  pointId: string,
): RegisterInfo | undefined {
  return config?.registers.holding.find((r) => r.name === pointId)
}

function formatValue(point: PointLive): string {
  if (point.value === null || point.value === undefined) return '—'
  if (typeof point.value === 'boolean') return point.value ? 'true' : 'false'
  return String(point.value)
}

export function PointsTable({
  deviceId,
  points,
  config,
}: {
  deviceId: string
  points: PointLive[]
  config?: SimbusConfig
}) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const patch = useMutation({
    mutationFn: ({ id, value }: { id: string; value: unknown }) =>
      apiSend(`/api/devices/${deviceId}/points/${id}`, 'PATCH', { value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points', deviceId] }),
  })

  const columns = useMemo(
    () => [
      { accessorKey: 'id', header: 'Point' },
      { accessorKey: 'kind', header: 'Kind' },
      { accessorKey: 'class', header: 'Class' },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }: { row: { original: PointLive } }) => {
          const point = row.original
          const hr = holdingForPoint(config, point.id)
          return (
            <span className="mono-value">
              {formatValue(point)}
              {point.unit ? ` ${point.unit}` : ''}
              {hr ? ` · HR${hr.address + 1}` : ''}
            </span>
          )
        },
      },
      {
        id: 'override',
        header: 'Override',
        cell: ({ row }: { row: { original: PointLive } }) => {
          const point = row.original
          if (point.kind === 'binary' && point.class === 'discrete') {
            return <span className="text-[var(--text-muted)]">read-only</span>
          }
          return (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                const raw = drafts[point.id] ?? String(point.value ?? '')
                const value = point.kind === 'binary' ? raw === 'true' || raw === '1' : Number(raw)
                patch.mutate({ id: point.id, value })
              }}
            >
              <input
                className="dc-input py-1 text-xs"
                value={drafts[point.id] ?? ''}
                placeholder={formatValue(point)}
                onChange={(e) => setDrafts((d) => ({ ...d, [point.id]: e.target.value }))}
              />
              <button className="btn btn-ghost text-xs" type="submit">
                Set
              </button>
            </form>
          )
        },
      },
    ],
    [config, drafts, patch],
  )

  const table = useLegacyTable({
    data: points,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-[var(--border)]">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="field-label px-2 py-2">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border-subtle)]">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-2 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
