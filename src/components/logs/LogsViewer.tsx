import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

interface Props {
  deviceId: string
}

const TAIL_OPTIONS = [50, 100, 200, 500]

export function LogsViewer({ deviceId }: Props) {
  const [tail, setTail] = useState(50)
  const [autoScroll, setAutoScroll] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const {
    data: logs,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<string>({
    queryKey: ['logs', deviceId, tail],
    queryFn: async () => {
      const res = await fetch(`/api/devices/${deviceId}/logs?tail=${tail}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    },
    refetchInterval: 5000,
    staleTime: 0,
    retry: false,
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const lines = logs?.split('\n').filter(Boolean) ?? []
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null

  return (
    <div
      className="flex flex-col gap-0 overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="field-label">Last</span>
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className="dc-input px-2 py-1.5 text-xs"
          >
            {TAIL_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} lines
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="size-3 accent-(--accent-cyan)"
            />
            <span className="field-label">Auto-scroll</span>
          </label>

          <button onClick={() => refetch()} className="btn btn-ghost px-2 py-0.5 text-[0.65rem]">
            Refresh
          </button>

          {updatedAt && (
            <span className="field-label" style={{ opacity: 0.6 }}>
              {updatedAt}
            </span>
          )}
        </div>
      </div>

      {/* Log content */}
      <div
        className="overflow-y-auto font-mono text-[0.7rem] leading-relaxed"
        style={{
          background: 'var(--bg-base)',
          maxHeight: '400px',
          color: 'var(--text-secondary)',
        }}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full"
                style={{ background: 'var(--accent-cyan)', animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : lines.length === 0 ? (
          <p className="p-4" style={{ color: 'var(--text-muted)' }}>
            No logs yet.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5 p-3">
            {lines.map((line, i) => {
              const isError = /error|fatal|exception/i.test(line)
              const isWarn = /warn/i.test(line)
              return (
                <div
                  key={i}
                  className="flex gap-3 px-1"
                  style={{
                    color: isError
                      ? 'var(--accent-red)'
                      : isWarn
                        ? 'var(--accent-amber)'
                        : 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      userSelect: 'none',
                      minWidth: '2.5rem',
                      textAlign: 'right',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{line}</span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
