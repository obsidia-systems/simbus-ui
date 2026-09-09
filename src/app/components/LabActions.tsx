import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiSend, type DeviceRecord } from '@/app/api'

type Action = 'stop' | 'start' | 'clear'

interface BulkResult {
  action: Action
  ok: number
  failed: number
}

export function LabActions({ devices }: { devices: DeviceRecord[] }) {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<Action | null>(null)

  const running = devices.filter((d) => d.dockerStatus === 'running').length
  const idle = devices.length - running

  const run = useMutation({
    mutationFn: (action: Action) => apiSend<BulkResult>('/api/site', 'POST', { action }),
    onSuccess: async (result) => {
      if (result.action === 'clear' && result.failed === 0) {
        queryClient.setQueryData(['devices'], [])
        queryClient.setQueryData(['fleet'], {})
      }
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      setConfirm(null)
    },
  })

  const busy = run.isPending
  const copy =
    confirm === 'stop'
      ? `Stop all ${running} running device${running === 1 ? '' : 's'}? BMS polling will fail until you start them again.`
      : confirm === 'start'
        ? `Start ${idle} device${idle === 1 ? '' : 's'} that ${idle === 1 ? 'is' : 'are'} not running?`
        : `Delete all ${devices.length} device${devices.length === 1 ? '' : 's'}, containers, YAML, and port leases? This cannot be undone.`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={busy || running === 0}
          onClick={() => {
            run.reset()
            setConfirm('stop')
          }}
        >
          Stop all
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={busy || idle === 0}
          onClick={() => {
            run.reset()
            setConfirm('start')
          }}
        >
          Start all
        </button>
        <button
          type="button"
          className="btn btn-danger text-xs"
          disabled={busy}
          onClick={() => {
            run.reset()
            setConfirm('clear')
          }}
        >
          Clean lab…
        </button>
      </div>

      {confirm && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-xs text-[var(--text-secondary)]">{copy}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={confirm === 'clear' ? 'btn btn-danger text-xs' : 'btn btn-primary text-xs'}
              disabled={busy}
              onClick={() => run.mutate(confirm)}
            >
              {busy
                ? 'Working…'
                : confirm === 'stop'
                  ? 'Stop all'
                  : confirm === 'start'
                    ? 'Start all'
                    : 'Delete all'}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {run.isError && (
        <p className="text-xs text-[var(--accent-red)]">
          {run.error instanceof Error ? run.error.message : 'Site action failed'}
        </p>
      )}
      {run.data && run.data.failed > 0 && !run.isPending && (
        <p className="text-xs text-[var(--accent-amber)]">
          {run.data.ok} ok, {run.data.failed} failed
        </p>
      )}
    </div>
  )
}
