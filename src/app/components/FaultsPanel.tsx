import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiSend } from '@/app/api'
import type { ActiveFault } from '@/types/simbus'

export function FaultsPanel({ deviceId }: { deviceId: string }) {
  const queryClient = useQueryClient()
  const faults = useQuery({
    queryKey: ['faults', deviceId],
    queryFn: () => apiGet<ActiveFault[]>(`/api/devices/${deviceId}/faults`),
    refetchInterval: 3000,
  })
  const clear = useMutation({
    mutationFn: () => apiSend(`/api/devices/${deviceId}/faults`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faults', deviceId] }),
  })

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="field-label">Faults</p>
          <h2 className="text-sm font-semibold">Injected</h2>
        </div>
        <button className="btn btn-ghost text-xs" onClick={() => clear.mutate()}>
          Clear
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {(faults.data ?? []).map((f, i) => (
          <li key={`${f.fault_type}-${i}`} className="font-mono text-xs text-[var(--accent-amber)]">
            {f.fault_type} {f.register_name ?? ''} {f.remaining_s}s left
          </li>
        ))}
        {(faults.data?.length ?? 0) === 0 && (
          <li className="text-xs text-[var(--text-muted)]">No active faults.</li>
        )}
      </ul>
    </div>
  )
}
