import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiSend } from '@/app/api'
import type { ScenarioActive, ScenarioInfo } from '@/types/simbus'

export function ScenariosPanel({ deviceId }: { deviceId: string }) {
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['scenarios', deviceId],
    queryFn: () => apiGet<ScenarioInfo[]>(`/api/devices/${deviceId}/scenarios`),
  })
  const active = useQuery({
    queryKey: ['scenarios-active', deviceId],
    queryFn: () => apiGet<ScenarioActive>(`/api/devices/${deviceId}/scenarios/active`),
    refetchInterval: 2000,
  })

  const run = useMutation({
    mutationFn: (id: string) => apiSend(`/api/devices/${deviceId}/scenarios/${id}/run`, 'POST', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scenarios-active', deviceId] })
    },
  })
  const stop = useMutation({
    mutationFn: () => apiSend(`/api/devices/${deviceId}/scenarios/stop`, 'POST', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scenarios-active', deviceId] })
    },
  })

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="field-label">Scenarios</p>
          <h2 className="text-sm font-semibold">Bundled in YAML</h2>
        </div>
        {active.data?.state === 'running' && (
          <button className="btn btn-ghost text-xs" onClick={() => stop.mutate()}>
            Stop
          </button>
        )}
      </div>
      {active.data?.scenario_name && (
        <p className="mb-3 text-xs text-[var(--accent-cyan)]">
          Active: {active.data.scenario_name} · step {active.data.step_index}/
          {active.data.total_steps}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {(list.data ?? []).map((s) => (
          <li
            key={s.id}
            className="flex items-start justify-between gap-3 rounded-md bg-[var(--bg-overlay)] p-3"
          >
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{s.description}</p>
            </div>
            <button
              className="btn btn-primary text-xs"
              onClick={() => run.mutate(s.id)}
              disabled={run.isPending}
            >
              Run
            </button>
          </li>
        ))}
        {(list.data?.length ?? 0) === 0 && (
          <li className="text-xs text-[var(--text-muted)]">No bundled scenarios.</li>
        )}
      </ul>
    </div>
  )
}
